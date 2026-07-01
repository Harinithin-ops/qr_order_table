import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harinithin.foodordersystem',
  appName: 'Food Order System',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
