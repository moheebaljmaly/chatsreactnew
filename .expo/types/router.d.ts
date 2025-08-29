/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/` | `/(tabs)/settings` | `/_sitemap` | `/auth/confirm-email` | `/auth/login` | `/auth/register` | `/settings`;
      DynamicRoutes: `/chat/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/chat/[id]`;
    }
  }
}
