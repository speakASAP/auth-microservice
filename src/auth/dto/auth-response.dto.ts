/**
 * Auth Response DTO
 */

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isActive: boolean;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

