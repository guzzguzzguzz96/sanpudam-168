import { Fragment } from "react";

// Thai text has no spaces between words, so browsers may wrap inside a
// word. Keep each space-separated phrase together and wrap only at spaces.
export function ThaiPhrases({ text }) {
  return text.split(" ").map((phrase, index) => (
    <Fragment key={index}>
      {index > 0 ? " " : null}
      <span className="thai-phrase">{phrase}</span>
    </Fragment>
  ));
}
