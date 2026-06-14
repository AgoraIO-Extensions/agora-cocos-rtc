declare module 'cc' {
  export class Node {
    children: Node[];
    setScale(x: number, y: number, z: number): void;
    getScale(): { x: number; y: number; z: number };
    getComponent<T>(type: new (...args: any[]) => T): T | null;
    getChildByName(name: string): Node | null;
  }

  export class Sprite {
    spriteFrame: SpriteFrame | null;
  }

  export class SpriteFrame {
    texture: Texture2D | null;
  }

  export class Texture2D {
    static Filter: {
      LINEAR: number;
      NONE: number;
    };

    static WrapMode: {
      CLAMP_TO_EDGE: number;
    };

    setFilters(minFilter: number, magFilter: number): void;
    setMipFilter(filter: number): void;
    setWrapMode(wrapS: number, wrapT: number, wrapR: number): void;
  }
}
