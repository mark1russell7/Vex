import type { Scope } from "./scope/scope";
import type { OLens } from "./optics";
import { Optional } from "../external/Funk/optional/optional";

/** Root proxy reading properties via current focus (RAW properties, not domain-filtered) */
export const focusRoot = <D>(scope: Scope<D>): object =>
  new Proxy({}, {
    get(_t, prop: string) {
      const ov = scope.getRawPropOpt(prop);   // <-- RAW
      return ov.tag === "Right" ? (ov as any).right : undefined;
    }
  });

/** Root proxy reading properties via a specific peer (RAW properties) */
export const peerRoot = <D>(scope: Scope<D>, key: string): object =>
  new Proxy({}, {
    get(_t, prop: string) {
      const ov = scope.getRawOfOpt(key, prop); // <-- RAW
      return ov.tag === "Right" ? (ov as any).right : undefined;
    }
  });

export const getFromFocus = <B, D>(scope: Scope<D>, ol: OLens<any, B>): Optional<B> =>
  ol.get(focusRoot(scope));

export const getFromPeer = <B, D>(scope: Scope<D>, key: string, ol: OLens<any, B>): Optional<B> =>
  ol.get(peerRoot(scope, key));
