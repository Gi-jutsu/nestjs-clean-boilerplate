import { IsEmail, IsString } from 'class-validator';

export class SignUpWithCredentialsHttpRequestBody {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
