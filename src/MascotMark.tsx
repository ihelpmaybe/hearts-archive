import { publicUrl } from "./publicUrl";

/** Heart’s Archive newsie — gallery home face. */
export function MascotMark() {
  return (
    <figure className="mascot-mark">
      <img
        className="mascot-mark-pic"
        src={publicUrl("brand/ha-mascot.png")}
        alt="Heart’s Archive newsie"
        width={512}
        height={768}
        decoding="async"
      />
    </figure>
  );
}
