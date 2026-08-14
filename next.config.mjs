/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * UI-2 moved the dashboard routes under section folders. These keep any
   * bookmarked or shared links working. `:id` matches a single segment, so
   * `/dashboard/profiles/<id>/edit` (four segments) never matches the
   * three-segment legacy patterns below.
   */
  async redirects() {
    return [
      { source: "/dashboard/tags", destination: "/dashboard/devices", permanent: false },
      {
        source: "/dashboard/:id/edit",
        destination: "/dashboard/profiles/:id/edit",
        permanent: false,
      },
      {
        source: "/dashboard/:id/analytics",
        destination: "/dashboard/profiles/:id/analytics",
        permanent: false,
      },
      {
        source: "/dashboard/:id/leads",
        destination: "/dashboard/profiles/:id/leads",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
