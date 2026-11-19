import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@courier/shared'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    agentUpgrade: 'security',
  },
};

export default nextConfig;
