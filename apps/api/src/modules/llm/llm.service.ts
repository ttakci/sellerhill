import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmFinishReason,
  LlmStreamTerminalReason,
  LlmUsagePurpose,
  LlmUsageSource,
  type LlmChatChunk,
  type LlmChatOptions,
  type LlmChatResult,
  type LlmMessage,
  type LlmTokenUsage,
} from '@repo/shared';

import { LlmUsageService } from './llm-usage.service';
import { LlmAbortError, LlmError, LlmRateLimitError, LlmResponseError, LlmTimeoutError, LlmUnavailableError } from './llm.errors';
import { ProviderLimiterService } from './provider-limiter.service';
import { parseSseChunk } from './sse-parser';

const DEFAULT_TEMPERATURE=0.4, DEFAULT_MAX_TOKENS=512, DEFAULT_TIMEOUT_MS=30_000, MAX_ATTEMPTS=3, DEFAULT_RETRY_AFTER_MS=1000;
interface ResolvedRequest { url:string; headers:Record<string,string>; body:string; model:string; timeoutMs:number }
interface StreamEvent { choices?:Array<{delta?:{content?:string};finish_reason?:string|null}>; model?:string; usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number} }

@Injectable()
export class LlmService {
  constructor(
    private readonly config: ConfigService,
    private readonly usage: LlmUsageService,
    private readonly limiter?: ProviderLimiterService,
  ) {}
  isAvailable():boolean { const base=(this.config.get<string>('LLM_BASE_URL')??'').trim(); return base.length>0&&[(this.config.get<string>('LLM_CONTENT_MODEL')??'').trim(),(this.config.get<string>('LLM_ASSISTANT_MODEL')??'').trim()].some(Boolean); }

  async chat(messages:LlmMessage[],opts:LlmChatOptions={}):Promise<LlmChatResult>{
    const model=this.resolveModel(opts), started=Date.now(), purpose=this.purpose(opts);
    const permit=await this.acquirePermit({userId:opts.userId,purpose,generationAttemptId:opts.generationAttemptId,estimatedPromptTokens:this.estimate(messages),maxCompletionTokens:opts.maxTokens??DEFAULT_MAX_TOKENS});
    try {
      const res=await this.request(messages,opts,model,false);
      const json=await res.json() as {choices?:Array<{message?:{content?:unknown};finish_reason?:string|null}>;model?:string;usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
      const text=json.choices?.[0]?.message?.content;
      if(typeof text!=='string'||text.length===0) {throw new LlmResponseError('LLM returned empty content',res.status);}
      const tokenUsage=this.tokenUsage(json.usage);
      const result:LlmChatResult={text,model:json.model??model,promptTokens:tokenUsage?.promptTokens,completionTokens:tokenUsage?.completionTokens,totalTokens:tokenUsage?.totalTokens,usage:tokenUsage,terminalObserved:true,terminalReason:LlmStreamTerminalReason.FINISH_REASON,finishReason:this.finish(json.choices?.[0]?.finish_reason)};
      const usageId=await this.log(opts,model,permit.reservedTokens,started,true,tokenUsage);
      if(opts.generationAttemptId&&usageId&&this.limiter) {await this.limiter.reconcile(opts.generationAttemptId,usageId);}
      return result;
    } catch(error){ await this.log(opts,model,permit.reservedTokens,started,false,undefined,error); throw error; }
    finally { await permit.release(); }
  }

  async *chatStream(messages:LlmMessage[],opts:LlmChatOptions={}):AsyncIterable<LlmChatChunk>{
    const model=this.resolveModel(opts),started=Date.now(),purpose=this.purpose(opts);
    const permit=await this.acquirePermit({userId:opts.userId,purpose,generationAttemptId:opts.generationAttemptId,estimatedPromptTokens:this.estimate(messages),maxCompletionTokens:opts.maxTokens??DEFAULT_MAX_TOKENS});
    let accumulated='',reader:ReadableStreamDefaultReader<Uint8Array>|undefined,usage:LlmTokenUsage|undefined,finishReason:LlmFinishReason|undefined,terminalReason=LlmStreamTerminalReason.ERROR,success=false,error:unknown;
    try {
      const res=await this.request(messages,opts,model,true);
      if(!res.body) {throw new LlmResponseError('LLM stream returned no body',res.status);}
      reader=res.body.getReader(); const decoder=new TextDecoder(); let rest='',terminal=false;
      while(!terminal){
        const read=await reader.read();
        if(read.done){ terminalReason=LlmStreamTerminalReason.NATURAL_CLOSE; break; }
        rest+=decoder.decode(read.value,{stream:true}); const parsed=parseSseChunk(rest); rest=parsed.rest;
        for(const event of parsed.events){
          if(event.data==='[DONE]'){terminal=true;terminalReason=LlmStreamTerminalReason.PROVIDER_DONE;break;}
          let payload:StreamEvent; try{payload=JSON.parse(event.data) as StreamEvent;}catch{continue;}
          usage=this.tokenUsage(payload.usage)??usage;
          const choice=payload.choices?.[0]; const delta=choice?.delta?.content;
          if(typeof delta==='string'&&delta.length>0){accumulated+=delta;yield{delta:accumulated,model,done:false};}
          if(choice?.finish_reason){finishReason=this.finish(choice.finish_reason);terminalReason=LlmStreamTerminalReason.FINISH_REASON;}
        }
      }
      success=true;
      yield {delta:accumulated,model,done:true,terminalObserved:terminalReason!==LlmStreamTerminalReason.NATURAL_CLOSE,terminalReason,finishReason,usage};
    } catch(caught){ error=caught; terminalReason=caught instanceof LlmAbortError?LlmStreamTerminalReason.CALLER_ABORT:caught instanceof LlmTimeoutError?LlmStreamTerminalReason.TIMEOUT:LlmStreamTerminalReason.ERROR; throw caught; }
    finally {
      if(reader){await reader.cancel().catch(()=>undefined);reader.releaseLock();}
      const usageId=await this.log(opts,model,permit.reservedTokens,started,success,usage,error);
      if(opts.generationAttemptId&&usageId&&this.limiter) {await this.limiter.reconcile(opts.generationAttemptId,usageId).catch(()=>undefined);}
      await permit.release();
    }
  }

  private acquirePermit(request: Parameters<ProviderLimiterService['acquire']>[0]) {
    if (this.limiter) {
      return this.limiter.acquire(request);
    }

    return Promise.resolve({
      leaseId: 'test',
      reservedTokens: 0,
      release: () => Promise.resolve(),
    });
  }

  private buildRequest(messages:LlmMessage[],opts:LlmChatOptions,model:string,stream:boolean):ResolvedRequest{
    const base=(this.config.get<string>('LLM_BASE_URL')??'').trim(),headers:Record<string,string>={'Content-Type':'application/json'},key=(this.config.get<string>('LLM_API_KEY')??'').trim(); if(key){headers.Authorization=`Bearer ${key}`;}
    return{url:`${base.replace(/\/$/,'')}/chat/completions`,headers,body:JSON.stringify({model,messages,temperature:opts.temperature??DEFAULT_TEMPERATURE,max_tokens:opts.maxTokens??DEFAULT_MAX_TOKENS,stream,...(stream?{stream_options:{include_usage:true}}:{})}),model,timeoutMs:opts.timeoutMs??this.readTimeout()};
  }
  private async request(messages:LlmMessage[],opts:LlmChatOptions,model:string,stream:boolean):Promise<Response>{
    const spec=this.buildRequest(messages,opts,model,stream),deadline=Date.now()+spec.timeoutMs,controller=new AbortController(); let timedOut=false,callerAborted=opts.signal?.aborted??false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},spec.timeoutMs),handler=()=>{callerAborted=true;controller.abort();}; if(opts.signal&&!opts.signal.aborted){opts.signal.addEventListener('abort',handler,{once:true});} else if(callerAborted){controller.abort();}
    try{for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){let res:Response;try{res=await fetch(spec.url,{method:'POST',headers:spec.headers,body:spec.body,signal:controller.signal});}catch(caught){if(caught instanceof Error&&caught.name==='AbortError'){if(callerAborted){throw new LlmAbortError();}if(timedOut){throw new LlmTimeoutError();}}throw caught instanceof LlmError?caught:new LlmUnavailableError(caught instanceof Error?caught.message:undefined);}
      if(res.status===429){const retry=this.parseRetryAfterMs(res.headers.get('Retry-After'));if(attempt===MAX_ATTEMPTS||retry>deadline-Date.now()){throw new LlmRateLimitError('LLM rate limited',retry);}await new Promise(resolve=>setTimeout(resolve,retry));continue;} if(!res.ok){const text=await res.text().catch(()=>'');throw new LlmResponseError(`LLM request failed (${res.status})${text?`: ${text.slice(0,200)}`:''}`,res.status);}return res;} throw new LlmRateLimitError();}
    finally{clearTimeout(timer);if(opts.signal){opts.signal.removeEventListener('abort',handler);}}
  }
  private async log(opts:LlmChatOptions,model:string,reservationTokens:number,started:number,success:boolean,tokens?:LlmTokenUsage,error?:unknown):Promise<string|undefined>{return this.usage.log({userId:opts.userId,purpose:this.purpose(opts),model,provider:this.config.get<string>('LLM_PROVIDER','default'),conversationId:opts.conversationId,messageId:opts.messageId,generationAttemptId:opts.generationAttemptId,promptTokens:tokens?.promptTokens,completionTokens:tokens?.completionTokens,reservationTokens,latencyMs:Date.now()-started,success,error:error instanceof Error?`${error.name}: ${error.message}`:error===undefined?undefined:String(error)});}
  private tokenUsage(value:StreamEvent['usage']):LlmTokenUsage|undefined{if(!value){return undefined;}const prompt=value.prompt_tokens??0,completion=value.completion_tokens??0;return{promptTokens:prompt,completionTokens:completion,totalTokens:value.total_tokens??prompt+completion,source:LlmUsageSource.PROVIDER};}
  private resolveModel(opts:LlmChatOptions):string{return opts.model?.trim()||((opts.purpose===LlmUsagePurpose.ASSISTANT?this.config.get<string>('LLM_ASSISTANT_MODEL'):this.config.get<string>('LLM_CONTENT_MODEL'))??'').trim();}
  private purpose(opts:LlmChatOptions):LlmUsagePurpose{
    const purpose = opts.purpose ?? LlmUsagePurpose.CONTENT;
    return purpose as LlmUsagePurpose;
  }
  private finish(value:string|null|undefined):LlmFinishReason|undefined{if(!value){return undefined;}return Object.values(LlmFinishReason).includes(value as LlmFinishReason)?value as LlmFinishReason:LlmFinishReason.UNKNOWN;}
  private estimate(messages:LlmMessage[]):number{return Math.ceil(messages.reduce((sum,message)=>sum+message.content.length,0)/4);}
  private readTimeout():number{const value=Number(this.config.get<string>('LLM_TIMEOUT_MS'));return Number.isFinite(value)&&value>0?value:DEFAULT_TIMEOUT_MS;}
  private parseRetryAfterMs(header:string|null):number{const seconds=Number(header);return header&&Number.isFinite(seconds)&&seconds>=0?Math.round(seconds*1000):DEFAULT_RETRY_AFTER_MS;}
}
