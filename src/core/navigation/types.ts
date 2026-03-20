/**
 * Navigation route type definitions for the KAS App JSON Renderer.
 */

// Auth flow screens
export type AuthStackParamList = {
  Auth: undefined;
  SpecList: undefined;
};

// Main app screens (after spec is loaded)
export type RootStackParamList = {
  Anchor: undefined;
  Calendar: undefined;
  Story: { entityType: string; entityId: number };
  AddFlow: { entityType: string; preFill?: Record<string, any> };
};
