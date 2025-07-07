import { IsEmail, IsString } from 'class-validator';

export class SignInWithCredentialsHttpRequestBody {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
