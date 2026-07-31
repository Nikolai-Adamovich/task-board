import { z } from 'zod';
import { HttpMethod } from '../constants/http.js';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  AcceptInvitationSchema,
  InvitationDetailsSchema,
  MyInvitationSchema,
} from '../schemas/auth.js';
import { UserSchema } from '../schemas/user.js';
import { ErrorResponseSchema } from '../schemas/common.js';
import { MyTaskSchema } from '../schemas/task.js';

/**
 * Auth-related API contracts.
 */
export const authContracts = {
  /** Register a new user account */
  register: {
    method: HttpMethod.Post,
    path: '/auth/register',
    body: RegisterRequestSchema,
    response: AuthResponseSchema,
    error: ErrorResponseSchema,
  },

  /** Log in with email and password */
  login: {
    method: HttpMethod.Post,
    path: '/auth/login',
    body: LoginRequestSchema,
    response: AuthResponseSchema,
    error: ErrorResponseSchema,
  },

  /** Get the currently authenticated user */
  me: {
    method: HttpMethod.Get,
    path: '/auth/me',
    response: UserSchema,
    error: ErrorResponseSchema,
  },

  /** Accept an invitation to join a tenant */
  acceptInvitation: {
    method: HttpMethod.Post,
    path: '/auth/accept-invitation',
    body: AcceptInvitationSchema,
    response: AuthResponseSchema,
    error: ErrorResponseSchema,
  },

  /** Get invitation details by token */
  getInvitation: {
    method: HttpMethod.Get,
    path: '/invitations/:token',
    response: InvitationDetailsSchema,
    error: ErrorResponseSchema,
  },

  /** Get pending invitations for the current user */
  getMyInvitations: {
    method: HttpMethod.Get,
    path: '/invitations/my',
    response: z.array(MyInvitationSchema),
    error: ErrorResponseSchema,
  },

  /** Get all tasks assigned to the current user across tenants */
  getMyTasks: {
    method: HttpMethod.Get,
    path: '/tasks/my',
    response: z.array(MyTaskSchema),
    error: ErrorResponseSchema,
  },
} as const;
