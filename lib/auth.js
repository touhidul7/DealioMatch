import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

const adminEmail = process.env.APP_ADMIN_EMAIL;
const adminPassword = process.env.APP_ADMIN_PASSWORD;

async function verifyPassword(rawPassword) {
  if (!adminPassword) return false;
  if (adminPassword.startsWith('$2')) {
    return bcrypt.compare(rawPassword, adminPassword);
  }
  return rawPassword === adminPassword;
}

export const authOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required.');
        }

        if (credentials.email !== adminEmail) {
          throw new Error('Invalid credentials.');
        }

        const valid = await verifyPassword(credentials.password);
        if (!valid) {
          throw new Error('Invalid credentials.');
        }

        return {
          id: 'admin-user',
          name: 'Admin',
          email: adminEmail,
          role: 'admin'
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      return session;
    }
  }
};
