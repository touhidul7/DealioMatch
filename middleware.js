export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/dashboard/:path*', '/buyers/:path*', '/listings/:path*', '/matches/:path*', '/settings/:path*', '/api/buyers/:path*', '/api/listings/:path*', '/api/match/:path*']
};
