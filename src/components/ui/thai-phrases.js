import { Fragment } from "react";

// Thai text has no spaces between words, so browsers may wrap inside a
// word. Keep each phrase together and wrap only between phrases. Phrases
// are separated by spaces, or by a zero-width space (U+200B) where a break
// is wanted without a visible gap.
export function ThaiPhrases({ text }) {
  return text.split(/( |\u200B)/).map((part, index) =>
    index % 2 ? (
      <Fragment key={index}>{part}</Fragment>
    ) : (
      <span key={index} className="thai-phrase">
        {part}
      </span>
    ),
  );
}
