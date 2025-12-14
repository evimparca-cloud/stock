import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          console.log('[AUTH] Starting authorization...');
          console.log('[AUTH] DATABASE_URL defined:', !!process.env.DATABASE_URL);

          if (!credentials?.email || !credentials?.password) {
            console.log('[AUTH] Missing credentials');
            return null;
          }

          const email = credentials.email.trim().toLowerCase();
          const password = credentials.password;

          console.log('[AUTH] Attempting login for:', email);

          let user = await prisma.user.findUnique({
            where: { email },
          });

          console.log('[AUTH] User found:', !!user);

          if (!user) {
            console.log('[AUTH] User not found');
            return null;
          }

          if (!user.password) {
            console.log('[AUTH] User has no password');
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            console.log('[AUTH] Invalid password');
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: (user as any).role ?? 'admin',
          };
        } catch (error) {
          console.error('[AUTH] Error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 saat (saniye cinsinden)
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 saat (saniye cinsinden)
  },
  pages: {
    signIn: '/pazaryeri1453',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Yeni login'de user bilgilerini token'a ekle
      if (user) {
        (token as any).role = (user as any).role ?? 'admin';
        (token as any).iat = Math.floor(Date.now() / 1000); // Token creation time
      }

      // Token yaş kontrolü (8 saat = 28800 saniye)
      const tokenAge = Math.floor(Date.now() / 1000) - ((token as any).iat || 0);
      if (tokenAge > 8 * 60 * 60) {
        console.log('[AUTH] Token expired (age:', tokenAge, 'seconds)');
        return {}; // Boş token döndürerek session'ı invalidate et
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role ?? 'admin';
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};
