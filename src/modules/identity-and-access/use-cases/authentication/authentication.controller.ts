import {
  Authenticate,
  CurrentSession,
  CurrentUser,
  Public,
  SignInService,
  type SessionRecord,
} from "@nestjs/authentication";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { AuthenticationUser } from "@modules/identity-and-access/infrastructure/authentication/authentication-user.js";
import { CredentialsService } from "@modules/identity-and-access/infrastructure/authentication/credentials.service.js";
import {
  SignInSchema,
  SignUpSchema,
  type SignInBody,
  type SignUpBody,
} from "./authentication.schemas.js";

@Controller("api/auth")
export class AuthenticationHttpController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly signInService: SignInService,
  ) {}

  @Public()
  @Post("sign-up/email")
  @HttpCode(200)
  async signUp(
    @Body({ schema: SignUpSchema }) body: SignUpBody,
    @Req() request: Request,
  ) {
    this.signInService.refuseCrossOrigin(request);
    const user = await this.credentials.register(
      body.name,
      body.email,
      body.password,
    );
    await this.signInService.signIn(user.id, { method: "password" });
    return { token: null, user };
  }

  @Public()
  @Post("sign-in/email")
  @HttpCode(200)
  async signIn(
    @Body({ schema: SignInSchema }) body: SignInBody,
    @Req() request: Request,
  ) {
    this.signInService.refuseCrossOrigin(request);
    const user = await this.credentials.verify(body.email, body.password);
    if (!user)
      throw new UnauthorizedException({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      });
    await this.signInService.signIn(user.id, { method: "password" });
    return { redirect: false, token: null, user };
  }

  @Authenticate({ optional: true })
  @Get("get-session")
  getSession(
    @CurrentUser() user: AuthenticationUser | null,
    @CurrentSession() session: SessionRecord | null,
    @Res() response: Response,
  ) {
    if (!user || !session) return response.json(null);
    return response.json({
      user,
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.lastActiveAt,
      },
    });
  }

  @Authenticate({ optional: true })
  @Post("sign-out")
  @HttpCode(200)
  async signOut() {
    await this.signInService.signOut();
    return { success: true };
  }
}
