import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { User, UserRepositoryResult, CreateUserData, UpdateUserProfileData } from '../types';

export class PrismaUserRepository {
  async createUser(userData: CreateUserData): Promise<UserRepositoryResult<User>> {
    try {
      // Hash password with salt
      const passwordHash = await bcrypt.hash(userData.password, 12);
      
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          password_hash: passwordHash,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email_verification_token: userData.verificationToken,
          email_verified: false,
          is_admin: false,
          is_banned: false,
          terms_accepted_at: new Date(),
        },
      });

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error creating user:', error);
      return this.handleCreateUserError(error);
    }
  }

  private handleCreateUserError(error: unknown): UserRepositoryResult<User> {
    // Handle Prisma unique constraint errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        // Unique constraint error
        const target = prismaError.meta?.target;
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            return {
              success: false,
              error: 'An account already exists with this email address',
            };
          }
          if (target.includes('username')) {
            return {
              success: false,
              error: 'This username is already taken',
            };
          }
        }
        return {
          success: false,
          error: 'This information is already used by another account',
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  async getUserByEmail(email: string): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving user by email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUserById(id: number): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving user by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateUser(id: number, data: UpdateUserProfileData): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          email: data.email,
          username: data.username,
          first_name: data.firstName,
          last_name: data.lastName,
          profile_image: data.profileImage,
          banner_image: data.bannerImage,
        },
      });

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error updating user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async toggleBan(id: number, isBanned: boolean): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { is_banned: isBanned },
      });

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error toggling ban:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async toggleAdmin(id: number, isAdmin: boolean): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { is_admin: isAdmin },
      });

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error toggling admin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async isUserAdmin(id: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { is_admin: true },
      });

      return user?.is_admin || false;
    } catch (error: unknown) {
      console.error('❌ Error verifying admin:', error);
      return false;
    }
  }

  async verifyEmail(token: string): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.findFirst({
        where: { email_verification_token: token },
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid verification token',
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verified: true,
          email_verification_token: null,
        },
      });

      return {
        success: true,
        user: updatedUser,
      };
    } catch (error: unknown) {
      console.error('❌ Error verifying email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updatePasswordResetToken(email: string, token: string, expiry: Date): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.update({
        where: { email },
        data: {
          reset_token: token,
          reset_token_expiry: expiry,
        },
      });

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error updating reset token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updatePassword(token: string, hashedPassword: string): Promise<UserRepositoryResult<User>> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          reset_token: token,
          reset_token_expiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired reset token',
        };
      }


      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          password_hash: hashedPassword,
          reset_token: null,
          reset_token_expiry: null,
        },
      });

      return {
        success: true,
        user: updatedUser,
      };
    } catch (error: unknown) {
      console.error('❌ Error updating password:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAllUsers(): Promise<UserRepositoryResult<User[]>> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        users,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving users:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        users: [],
      };
    }
  }

  async initializeTables(): Promise<void> {
    // Prisma handles table creation automatically via migrations
    // This method is kept for compatibility
    return;
  }
}
