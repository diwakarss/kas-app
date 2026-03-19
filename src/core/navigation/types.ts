/**
 * Navigation route type definitions for the KAS App JSON Renderer.
 */

export type RootStackParamList = {
  Anchor: undefined;
  Calendar: undefined;
  Story: { entityType: string; entityId: number };
  AddFlow: { entityType: string; preFill?: Record<string, any> };
};
