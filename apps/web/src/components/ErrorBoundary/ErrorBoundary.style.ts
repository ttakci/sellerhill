import { tkn } from '@repo/ui';
import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${tkn('tokens.space.xl')};
  background-color: ${tkn('tokens.colors.background')};
`;

export const ErrorIcon = styled.div`
  font-size: 64px;
  margin-bottom: ${tkn('tokens.space.lg')};
`;

export const Title = styled.h1`
  font-size: ${tkn('tokens.fontSize.lg')};
  font-weight: ${tkn('tokens.fontWeight.semibold')};
  color: ${tkn('tokens.colors.text')};
  margin-bottom: ${tkn('tokens.space.md')};
  text-align: center;
`;

export const Message = styled.p`
  font-size: ${tkn('tokens.fontSize.md')};
  color: ${tkn('tokens.colors.muted')};
  margin-bottom: ${tkn('tokens.space.xl')};
  text-align: center;
  max-width: 500px;
`;

export const Details = styled.details`
  margin-top: ${tkn('tokens.space.lg')};
  padding: ${tkn('tokens.space.md')};
  background-color: ${tkn('tokens.colors.surface')};
  border-radius: ${tkn('tokens.radius.md')};
  max-width: 600px;
  width: 100%;
`;

export const Summary = styled.summary`
  cursor: pointer;
  font-weight: ${tkn('tokens.fontWeight.medium')};
  color: ${tkn('tokens.colors.muted')};
  margin-bottom: ${tkn('tokens.space.sm')};

  &:hover {
    color: ${tkn('tokens.colors.text')};
  }
`;

export const ErrorStack = styled.pre`
  font-size: ${tkn('tokens.fontSize.sm')};
  color: ${tkn('tokens.colors.danger')};
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: ${tkn('tokens.space.md')};
  margin-top: ${tkn('tokens.space.lg')};
`;
