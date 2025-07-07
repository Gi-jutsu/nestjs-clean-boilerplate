import { IsEmail } from 'class-validator';

export class ForgotPasswordHttpRequestBody {
  @IsEmail()
  email: string;
}
