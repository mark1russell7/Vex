/** The install command of the packages, with a button that copies it. */
import { useState, type ReactElement } from "react";

const COMMAND = "npm i @mark1russell7/vex @mark1russell7/vex-domains";

/** The install line. */
export default function CopyInstall(): ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <div className="vx-install">
      <code>{COMMAND}</code>
      <button
        type="button"
        className="vx-button"
        aria-label="Copy the install command"
        onClick={() => {
          void navigator.clipboard?.writeText(COMMAND).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
