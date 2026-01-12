import type { CreateExampleFormData } from '@repo/shared';

export interface ExampleFormProps {
  onSubmit: (data: CreateExampleFormData) => void | Promise<void>;
  defaultValues?: Partial<CreateExampleFormData>;
}
