/**
 * A small profanity check for player names. Catches common look-alike spellings
 * (3→e, 4/@→a, !/1/|→i or l, 0→o, $/5→s, 7/+→t, v→u), accents, separators ("f.u.c.k"),
 * and stretched letters ("fuuuck"). Not exhaustive; it keeps casual abuse out of
 * names without flagging ordinary ones like Cassandra or Dickens.
 */

/** Rarely innocent inside a longer word: matched anywhere in the name. */
const ANYWHERE = [
  "fuck", "fck", "shit", "cunt", "nigger", "nigga", "faggot", "bitch", "whore", "slut", "bastard",
  "asshole", "arsehole", "dickhead", "motherf", "wanker", "retard", "pussy", "penis", "vagina", "dildo",
  "jizz", "cock sucker", "cocksucker", "blowjob", "handjob", "nazi", "hitler", "kike", "chink", "tranny", "twat", "bollock", "porn", "hentai", "boner", "horny", "milf", "gtfo", "stfu", "dumbass", "jackass", "fatass", "smartass",
];

/** Common inside ordinary words: matched only as a whole word, or as the whole name. */
const WHOLE_WORD = [
  "ass", "arse", "dick", "cock", "tit", "tits", "fag", "fags", "hoe", "hoes", "cum", "piss", "crap",
  "damn", "sex", "sexy", "anal", "anus", "rape", "nut", "nuts", "prick", "slag", "skank", "thot", "wtf",
  "fuk", "fk", "sht", "rapist", "spic", "spics", "dyke", "homo", "coon", "gook", "wop", "jap", "paki", "negro", "poop", "butt", "kkk",
];

/** Names (and places) that contain an ANYWHERE word innocently. */
const ALLOWED = ["shiitake", "shitake", "scunthorpe", "matsushita", "cockburn", "hancock", "dickens", "penistone", "pussycat"];

const LEET: Record<string, string> = {
  "0": "o",
  "2": "z",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "6": "g",
  "7": "t",
  "+": "t",
  "8": "b",
  "9": "g",
  "€": "e",
  "£": "l",
  "!": "i",
  "¡": "i",
};
/** Characters that read as either i or l. */
const I_OR_L = new Set(["1", "|"]);

function collapse(text: string, keep: number): string {
  return text.replace(/(.)\1+/g, (run, letter: string) => letter.repeat(Math.min(run.length, keep)));
}

/** The name read a few ways (1/| as i or l; v as u), lower-case letters and spaces only. */
function readings(name: string): string[] {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ph/g, "f");
  const read = (ambiguous: string) =>
    [...base]
      .map((char) => (I_OR_L.has(char) ? ambiguous : (LEET[char] ?? char)))
      .join("")
      .replace(/[^a-z]+/g, " ")
      .trim();
  const asI = read("i");
  // Also read v as u ("fvck", "cvnt").
  return [asI, read("l"), asI.replace(/v/g, "u")];
}

const anywhere = ANYWHERE.map((word) => collapse(word.replace(/ /g, ""), 1));
const wholeWord = new Set(WHOLE_WORD.map((word) => collapse(word, 2)));

/** True if the name contains a blocked word, even disguised. */
export function isProfane(name: string): boolean {
  for (const reading of readings(name)) {
    const joined = reading.replace(/ /g, "");
    if (ALLOWED.some((word) => joined.includes(word))) continue;
    // Anywhere, ignoring separators and stretched letters.
    const squeezed = collapse(joined, 1);
    if (anywhere.some((word) => squeezed.includes(word))) return true;
    // Whole words, or the whole name spelled out ("a s s").
    const tokens = reading.split(" ").map((token) => collapse(token, 2));
    if (tokens.some((token) => wholeWord.has(token)) || wholeWord.has(collapse(joined, 2))) return true;
  }
  return false;
}
