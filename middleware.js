import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      if (req.nextUrl.pathname.startsWith('/api/auth')) return true;
      return Boolean(token);
    }
  }
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/buyers/:path*',
    '/listings/:path*',
    '/matches/:path*',
    '/settings/:path*',
    '/api/:path*'
  ]
};
