export interface EmojiItem {
  emoji: string;
  name: string;
  keywords: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}

export const COMPLETE_EMOJI_DATA: EmojiCategory[] = [
  {
    "id": "smileys",
    "name": "Smileys & Emotion",
    "icon": "happy-outline",
    "emojis": [
      {
        "emoji": "😀",
        "name": "grinning face",
        "keywords": [
          "smile",
          "happy",
          "grin",
          "face"
        ]
      },
      {
        "emoji": "😃",
        "name": "grinning face with big eyes",
        "keywords": [
          "happy",
          "joy",
          "smile"
        ]
      },
      {
        "emoji": "😄",
        "name": "grinning face with smiling eyes",
        "keywords": [
          "happy",
          "laugh",
          "smile"
        ]
      },
      {
        "emoji": "😁",
        "name": "beaming face with smiling eyes",
        "keywords": [
          "grin",
          "smile",
          "happy"
        ]
      },
      {
        "emoji": "😆",
        "name": "grinning squinting face",
        "keywords": [
          "laugh",
          "lol",
          "haha",
          "happy"
        ]
      },
      {
        "emoji": "😅",
        "name": "grinning face with sweat",
        "keywords": [
          "sweat",
          "phew",
          "nervous",
          "laugh"
        ]
      },
      {
        "emoji": "🤣",
        "name": "rolling on the floor laughing",
        "keywords": [
          "rofl",
          "lmao",
          "lol",
          "laugh"
        ]
      },
      {
        "emoji": "😂",
        "name": "face with tears of joy",
        "keywords": [
          "cry",
          "laugh",
          "lol",
          "joy",
          "funny"
        ]
      },
      {
        "emoji": "🙂",
        "name": "slightly smiling face",
        "keywords": [
          "smile",
          "ok",
          "happy"
        ]
      },
      {
        "emoji": "🙃",
        "name": "upside-down face",
        "keywords": [
          "silly",
          "sarcasm",
          "irony"
        ]
      },
      {
        "emoji": "🫠",
        "name": "melting face",
        "keywords": [
          "melt",
          "hot",
          "awkward",
          "disappear"
        ]
      },
      {
        "emoji": "😉",
        "name": "winking face",
        "keywords": [
          "wink",
          "flirt",
          "joke"
        ]
      },
      {
        "emoji": "😊",
        "name": "smiling face with smiling eyes",
        "keywords": [
          "blush",
          "warm",
          "happy"
        ]
      },
      {
        "emoji": "😇",
        "name": "smiling face with halo",
        "keywords": [
          "angel",
          "innocent",
          "good"
        ]
      },
      {
        "emoji": "🥰",
        "name": "smiling face with hearts",
        "keywords": [
          "love",
          "crush",
          "adore",
          "heart"
        ]
      },
      {
        "emoji": "😍",
        "name": "smiling face with heart-eyes",
        "keywords": [
          "love",
          "crush",
          "heart",
          "adore"
        ]
      },
      {
        "emoji": "🤩",
        "name": "star-struck",
        "keywords": [
          "excited",
          "star",
          "wow",
          "amazing"
        ]
      },
      {
        "emoji": "😘",
        "name": "face blowing a kiss",
        "keywords": [
          "kiss",
          "love",
          "flirt"
        ]
      },
      {
        "emoji": "😗",
        "name": "kissing face",
        "keywords": [
          "kiss",
          "love"
        ]
      },
      {
        "emoji": "😚",
        "name": "kissing face with closed eyes",
        "keywords": [
          "kiss",
          "sweet"
        ]
      },
      {
        "emoji": "😙",
        "name": "kissing face with smiling eyes",
        "keywords": [
          "kiss",
          "happy"
        ]
      },
      {
        "emoji": "🥲",
        "name": "smiling face with tear",
        "keywords": [
          "proud",
          "touched",
          "gratitude",
          "happy cry"
        ]
      },
      {
        "emoji": "😋",
        "name": "face savoring food",
        "keywords": [
          "yum",
          "delicious",
          "tasty",
          "food",
          "nom"
        ]
      },
      {
        "emoji": "😛",
        "name": "face with tongue",
        "keywords": [
          "tongue",
          "silly",
          "joke"
        ]
      },
      {
        "emoji": "😜",
        "name": "winking face with tongue",
        "keywords": [
          "crazy",
          "wink",
          "silly"
        ]
      },
      {
        "emoji": "🤪",
        "name": "zany face",
        "keywords": [
          "crazy",
          "wild",
          "party"
        ]
      },
      {
        "emoji": "😝",
        "name": "squinting face with tongue",
        "keywords": [
          "tongue",
          "playful",
          "lol"
        ]
      },
      {
        "emoji": "🤑",
        "name": "money-mouth face",
        "keywords": [
          "rich",
          "money",
          "dollar",
          "cash"
        ]
      },
      {
        "emoji": "🤗",
        "name": "smiling face with open hands",
        "keywords": [
          "hug",
          "hugging",
          "warm"
        ]
      },
      {
        "emoji": "🤭",
        "name": "face with hand over mouth",
        "keywords": [
          "oops",
          "giggle",
          "secret"
        ]
      },
      {
        "emoji": "🫢",
        "name": "face with open eyes and hand over mouth",
        "keywords": [
          "gasp",
          "shock",
          "surprise"
        ]
      },
      {
        "emoji": "🫣",
        "name": "face with peeking eye",
        "keywords": [
          "peek",
          "scared",
          "shy",
          "look"
        ]
      },
      {
        "emoji": "🤫",
        "name": "shushing face",
        "keywords": [
          "quiet",
          "secret",
          "shh",
          "silence"
        ]
      },
      {
        "emoji": "🤔",
        "name": "thinking face",
        "keywords": [
          "think",
          "idea",
          "ponder",
          "hmm"
        ]
      },
      {
        "emoji": "🫡",
        "name": "saluting face",
        "keywords": [
          "salute",
          "respect",
          "yes",
          "sir",
          "roger"
        ]
      },
      {
        "emoji": "🤐",
        "name": "zipper-mouth face",
        "keywords": [
          "zip",
          "secret",
          "silent",
          "quiet"
        ]
      },
      {
        "emoji": "🤨",
        "name": "face with raised eyebrow",
        "keywords": [
          "skeptical",
          "suspicious",
          "doubt"
        ]
      },
      {
        "emoji": "😐",
        "name": "neutral face",
        "keywords": [
          "meh",
          "blank",
          "ok"
        ]
      },
      {
        "emoji": "😑",
        "name": "expressionless face",
        "keywords": [
          "poker",
          "done",
          "annoyed"
        ]
      },
      {
        "emoji": "😶",
        "name": "face without mouth",
        "keywords": [
          "speechless",
          "silent",
          "quiet"
        ]
      },
      {
        "emoji": "🫥",
        "name": "dotted line face",
        "keywords": [
          "invisible",
          "hidden",
          "fade",
          "ghost"
        ]
      },
      {
        "emoji": "😶‍🌫️",
        "name": "face in clouds",
        "keywords": [
          "fog",
          "lost",
          "cloud",
          "daydream"
        ]
      },
      {
        "emoji": "😏",
        "name": "smirking face",
        "keywords": [
          "smirk",
          "flirt",
          "sly",
          "cool"
        ]
      },
      {
        "emoji": "😒",
        "name": "unamused face",
        "keywords": [
          "annoyed",
          "meh",
          "dislike"
        ]
      },
      {
        "emoji": "🙄",
        "name": "face with rolling eyes",
        "keywords": [
          "eyeroll",
          "bored",
          "annoyed"
        ]
      },
      {
        "emoji": "😬",
        "name": "grimacing face",
        "keywords": [
          "yikes",
          "awkward",
          "cringe"
        ]
      },
      {
        "emoji": "😮‍💨",
        "name": "face exhaling",
        "keywords": [
          "sigh",
          "relief",
          "tired",
          "phew"
        ]
      },
      {
        "emoji": "🤥",
        "name": "lying face",
        "keywords": [
          "lie",
          "pinocchio",
          "fake"
        ]
      },
      {
        "emoji": "😌",
        "name": "relieved face",
        "keywords": [
          "calm",
          "peace",
          "relieved"
        ]
      },
      {
        "emoji": "😔",
        "name": "pensive face",
        "keywords": [
          "sad",
          "depressed",
          "gloomy"
        ]
      },
      {
        "emoji": "😪",
        "name": "sleepy face",
        "keywords": [
          "tired",
          "sleep",
          "rest"
        ]
      },
      {
        "emoji": "🤤",
        "name": "drooling face",
        "keywords": [
          "drool",
          "delicious",
          "hungry"
        ]
      },
      {
        "emoji": "😴",
        "name": "sleeping face",
        "keywords": [
          "sleep",
          "zzz",
          "night",
          "tired"
        ]
      },
      {
        "emoji": "😷",
        "name": "face with medical mask",
        "keywords": [
          "mask",
          "sick",
          "covid",
          "ill"
        ]
      },
      {
        "emoji": "🤒",
        "name": "face with thermometer",
        "keywords": [
          "sick",
          "fever",
          "ill"
        ]
      },
      {
        "emoji": "🤕",
        "name": "face with head-bandage",
        "keywords": [
          "hurt",
          "injury",
          "accident"
        ]
      },
      {
        "emoji": "🤢",
        "name": "nauseated face",
        "keywords": [
          "disgust",
          "gross",
          "sick"
        ]
      },
      {
        "emoji": "🤮",
        "name": "face vomiting",
        "keywords": [
          "puke",
          "gross",
          "barf"
        ]
      },
      {
        "emoji": "🤧",
        "name": "sneezing face",
        "keywords": [
          "sneeze",
          "cold",
          "flu"
        ]
      },
      {
        "emoji": "🥵",
        "name": "hot face",
        "keywords": [
          "heat",
          "summer",
          "sweat",
          "hot"
        ]
      },
      {
        "emoji": "🥶",
        "name": "cold face",
        "keywords": [
          "freezing",
          "winter",
          "ice",
          "cold"
        ]
      },
      {
        "emoji": "🥴",
        "name": "woozy face",
        "keywords": [
          "drunk",
          "dizzy",
          "tired"
        ]
      },
      {
        "emoji": "😵",
        "name": "face with crossed-out eyes",
        "keywords": [
          "dead",
          "dizzy",
          "shocked"
        ]
      },
      {
        "emoji": "😵‍💫",
        "name": "face with spiral eyes",
        "keywords": [
          "hypnotized",
          "dizzy",
          "overwhelmed"
        ]
      },
      {
        "emoji": "🤯",
        "name": "exploding head",
        "keywords": [
          "mindblown",
          "shocked",
          "boom",
          "wow"
        ]
      },
      {
        "emoji": "🤠",
        "name": "cowboy hat face",
        "keywords": [
          "cowboy",
          "country",
          "western"
        ]
      },
      {
        "emoji": "🥳",
        "name": "partying face",
        "keywords": [
          "party",
          "celebration",
          "birthday",
          "woo"
        ]
      },
      {
        "emoji": "🥸",
        "name": "disguised face",
        "keywords": [
          "disguise",
          "glasses",
          "spy",
          "incognito"
        ]
      },
      {
        "emoji": "😎",
        "name": "smiling face with sunglasses",
        "keywords": [
          "cool",
          "shades",
          "boss",
          "sun"
        ]
      },
      {
        "emoji": "🤓",
        "name": "nerd face",
        "keywords": [
          "geek",
          "nerd",
          "smart",
          "glasses"
        ]
      },
      {
        "emoji": "🧐",
        "name": "face with monocle",
        "keywords": [
          "investigate",
          "curious",
          "smart"
        ]
      },
      {
        "emoji": "😕",
        "name": "confused face",
        "keywords": [
          "confused",
          "puzzled",
          "huh"
        ]
      },
      {
        "emoji": "😟",
        "name": "worried face",
        "keywords": [
          "worry",
          "scared",
          "nervous"
        ]
      },
      {
        "emoji": "🙁",
        "name": "slightly frowning face",
        "keywords": [
          "sad",
          "disappointed"
        ]
      },
      {
        "emoji": "☹️",
        "name": "frowning face",
        "keywords": [
          "sad",
          "unhappy",
          "cry"
        ]
      },
      {
        "emoji": "😮",
        "name": "face with open mouth",
        "keywords": [
          "gasp",
          "wow",
          "surprised"
        ]
      },
      {
        "emoji": "😯",
        "name": "hushed face",
        "keywords": [
          "silence",
          "surprise",
          "quiet"
        ]
      },
      {
        "emoji": "😲",
        "name": "astonished face",
        "keywords": [
          "shock",
          "amazed",
          "omg"
        ]
      },
      {
        "emoji": "😳",
        "name": "flushed face",
        "keywords": [
          "blush",
          "embarrassed",
          "shy"
        ]
      },
      {
        "emoji": "🥺",
        "name": "pleading face",
        "keywords": [
          "puppy",
          "please",
          "beg",
          "cute"
        ]
      },
      {
        "emoji": "🥹",
        "name": "face holding back tears",
        "keywords": [
          "proud",
          "crying",
          "moved",
          "emotional"
        ]
      },
      {
        "emoji": "😦",
        "name": "frowning face with open mouth",
        "keywords": [
          "shocked",
          "sad"
        ]
      },
      {
        "emoji": "😧",
        "name": "anguished face",
        "keywords": [
          "pain",
          "shock"
        ]
      },
      {
        "emoji": "😨",
        "name": "fearful face",
        "keywords": [
          "scared",
          "fear",
          "spooked"
        ]
      },
      {
        "emoji": "😰",
        "name": "anxious face with sweat",
        "keywords": [
          "nervous",
          "anxiety",
          "worried"
        ]
      },
      {
        "emoji": "😥",
        "name": "sad but relieved face",
        "keywords": [
          "sad",
          "phew",
          "relieved"
        ]
      },
      {
        "emoji": "😢",
        "name": "crying face",
        "keywords": [
          "cry",
          "sad",
          "tear"
        ]
      },
      {
        "emoji": "😭",
        "name": "loudly crying face",
        "keywords": [
          "sob",
          "cry",
          "sad",
          "tears",
          "bawling"
        ]
      },
      {
        "emoji": "😱",
        "name": "face screaming in fear",
        "keywords": [
          "scream",
          "scared",
          "horror",
          "omg"
        ]
      },
      {
        "emoji": "😖",
        "name": "confounded face",
        "keywords": [
          "frustrated",
          "struggle"
        ]
      },
      {
        "emoji": "😣",
        "name": "persevering face",
        "keywords": [
          "persevere",
          "endure",
          "trying"
        ]
      },
      {
        "emoji": "😞",
        "name": "disappointed face",
        "keywords": [
          "sad",
          "fail",
          "bummed"
        ]
      },
      {
        "emoji": "😓",
        "name": "downcast face with sweat",
        "keywords": [
          "hard",
          "tired",
          "sweat"
        ]
      },
      {
        "emoji": "😩",
        "name": "weary face",
        "keywords": [
          "tired",
          "frustrated",
          "stressed"
        ]
      },
      {
        "emoji": "😫",
        "name": "tired face",
        "keywords": [
          "exhausted",
          "done",
          "sleep"
        ]
      },
      {
        "emoji": "🥱",
        "name": "yawning face",
        "keywords": [
          "yawn",
          "sleepy",
          "bored"
        ]
      },
      {
        "emoji": "😤",
        "name": "face with steam from nose",
        "keywords": [
          "triumph",
          "angry",
          "huff"
        ]
      },
      {
        "emoji": "😡",
        "name": "enraged face",
        "keywords": [
          "mad",
          "angry",
          "rage"
        ]
      },
      {
        "emoji": "😠",
        "name": "angry face",
        "keywords": [
          "angry",
          "mad",
          "grumpy"
        ]
      },
      {
        "emoji": "🤬",
        "name": "face with symbols on mouth",
        "keywords": [
          "swear",
          "cuss",
          "angry",
          "furious"
        ]
      },
      {
        "emoji": "😈",
        "name": "smiling face with horns",
        "keywords": [
          "devil",
          "evil",
          "naughty"
        ]
      },
      {
        "emoji": "👿",
        "name": "angry face with horns",
        "keywords": [
          "demon",
          "devil",
          "rage"
        ]
      },
      {
        "emoji": "💀",
        "name": "skull",
        "keywords": [
          "dead",
          "skeleton",
          "danger",
          "death",
          "lol"
        ]
      },
      {
        "emoji": "☠️",
        "name": "skull and crossbones",
        "keywords": [
          "poison",
          "danger",
          "pirate",
          "dead"
        ]
      },
      {
        "emoji": "💩",
        "name": "pile of poo",
        "keywords": [
          "poop",
          "poo",
          "crap",
          "funny"
        ]
      },
      {
        "emoji": "🤡",
        "name": "clown face",
        "keywords": [
          "clown",
          "fool",
          "joke",
          "circus"
        ]
      },
      {
        "emoji": "👹",
        "name": "ogre",
        "keywords": [
          "monster",
          "demon",
          "japanese"
        ]
      },
      {
        "emoji": "👺",
        "name": "goblin",
        "keywords": [
          "mask",
          "tengu",
          "evil"
        ]
      },
      {
        "emoji": "👻",
        "name": "ghost",
        "keywords": [
          "spooky",
          "halloween",
          "boo",
          "ninja",
          "stealth"
        ]
      },
      {
        "emoji": "👽",
        "name": "alien",
        "keywords": [
          "ufo",
          "extraterrestrial",
          "space"
        ]
      },
      {
        "emoji": "👾",
        "name": "alien monster",
        "keywords": [
          "arcade",
          "game",
          "space invader"
        ]
      },
      {
        "emoji": "🤖",
        "name": "robot",
        "keywords": [
          "bot",
          "ai",
          "tech",
          "machine"
        ]
      },
      {
        "emoji": "😺",
        "name": "grinning cat",
        "keywords": [
          "cat",
          "smile",
          "happy"
        ]
      },
      {
        "emoji": "😸",
        "name": "grinning cat with smiling eyes",
        "keywords": [
          "cat",
          "smile",
          "laugh"
        ]
      },
      {
        "emoji": "😹",
        "name": "cat with tears of joy",
        "keywords": [
          "cat",
          "laugh",
          "lol"
        ]
      },
      {
        "emoji": "😻",
        "name": "smiling cat with heart-eyes",
        "keywords": [
          "cat",
          "love",
          "crush"
        ]
      },
      {
        "emoji": "😼",
        "name": "cat with wry smile",
        "keywords": [
          "cat",
          "smirk"
        ]
      },
      {
        "emoji": "😽",
        "name": "kissing cat",
        "keywords": [
          "cat",
          "kiss"
        ]
      },
      {
        "emoji": "🙀",
        "name": "weary cat",
        "keywords": [
          "cat",
          "shocked",
          "scream"
        ]
      },
      {
        "emoji": "😿",
        "name": "crying cat",
        "keywords": [
          "cat",
          "sad",
          "cry"
        ]
      },
      {
        "emoji": "😾",
        "name": "pouting cat",
        "keywords": [
          "cat",
          "angry",
          "grumpy"
        ]
      }
    ]
  },
  {
    "id": "people",
    "name": "People & Gestures",
    "icon": "hand-left-outline",
    "emojis": [
      {
        "emoji": "👋",
        "name": "waving hand",
        "keywords": [
          "wave",
          "hello",
          "bye",
          "hi"
        ]
      },
      {
        "emoji": "🤚",
        "name": "raised back of hand",
        "keywords": [
          "backhand",
          "stop"
        ]
      },
      {
        "emoji": "🖐️",
        "name": "hand with fingers splayed",
        "keywords": [
          "five",
          "high five"
        ]
      },
      {
        "emoji": "✋",
        "name": "raised hand",
        "keywords": [
          "stop",
          "high five",
          "halt"
        ]
      },
      {
        "emoji": "🖖",
        "name": "vulcan salute",
        "keywords": [
          "spock",
          "star trek",
          "peace"
        ]
      },
      {
        "emoji": "🫱",
        "name": "rightwards hand",
        "keywords": [
          "hand",
          "reach"
        ]
      },
      {
        "emoji": "🫲",
        "name": "leftwards hand",
        "keywords": [
          "hand",
          "reach"
        ]
      },
      {
        "emoji": "🫵",
        "name": "index pointing at the viewer",
        "keywords": [
          "you",
          "point",
          "pick"
        ]
      },
      {
        "emoji": "👌",
        "name": "OK hand",
        "keywords": [
          "perfect",
          "good",
          "agree",
          "ok"
        ]
      },
      {
        "emoji": "🤌",
        "name": "pinched fingers",
        "keywords": [
          "italian",
          "chef kiss",
          "what"
        ]
      },
      {
        "emoji": "🤏",
        "name": "pinching hand",
        "keywords": [
          "tiny",
          "small",
          "little"
        ]
      },
      {
        "emoji": "✌️",
        "name": "victory hand",
        "keywords": [
          "peace",
          "victory",
          "two"
        ]
      },
      {
        "emoji": "🤞",
        "name": "crossed fingers",
        "keywords": [
          "luck",
          "hope",
          "wish"
        ]
      },
      {
        "emoji": "🫰",
        "name": "hand with index finger and thumb crossed",
        "keywords": [
          "kpop",
          "finger heart",
          "love"
        ]
      },
      {
        "emoji": "🤟",
        "name": "love-you gesture",
        "keywords": [
          "ily",
          "love",
          "rock"
        ]
      },
      {
        "emoji": "🤘",
        "name": "sign of the horns",
        "keywords": [
          "rock on",
          "metal",
          "party"
        ]
      },
      {
        "emoji": "🤙",
        "name": "call me hand",
        "keywords": [
          "shaka",
          "hang loose",
          "call",
          "cool"
        ]
      },
      {
        "emoji": "👈",
        "name": "backhand index pointing left",
        "keywords": [
          "left",
          "point"
        ]
      },
      {
        "emoji": "👉",
        "name": "backhand index pointing right",
        "keywords": [
          "right",
          "point"
        ]
      },
      {
        "emoji": "👆",
        "name": "backhand index pointing up",
        "keywords": [
          "up",
          "look"
        ]
      },
      {
        "emoji": "🖕",
        "name": "middle finger",
        "keywords": [
          "flip off",
          "rude"
        ]
      },
      {
        "emoji": "👇",
        "name": "backhand index pointing down",
        "keywords": [
          "down",
          "look"
        ]
      },
      {
        "emoji": "☝️",
        "name": "index pointing up",
        "keywords": [
          "one",
          "first",
          "question"
        ]
      },
      {
        "emoji": "👍",
        "name": "thumbs up",
        "keywords": [
          "like",
          "approve",
          "yes",
          "good",
          "ok"
        ]
      },
      {
        "emoji": "👎",
        "name": "thumbs down",
        "keywords": [
          "dislike",
          "no",
          "bad"
        ]
      },
      {
        "emoji": "✊",
        "name": "raised fist",
        "keywords": [
          "power",
          "solidarity",
          "strength"
        ]
      },
      {
        "emoji": "👊",
        "name": "oncoming fist",
        "keywords": [
          "fist bump",
          "punch",
          "bro"
        ]
      },
      {
        "emoji": "🤛",
        "name": "left-facing fist",
        "keywords": [
          "bump",
          "punch"
        ]
      },
      {
        "emoji": "🤜",
        "name": "right-facing fist",
        "keywords": [
          "bump",
          "punch"
        ]
      },
      {
        "emoji": "👏",
        "name": "clapping hands",
        "keywords": [
          "applause",
          "bravo",
          "congrats"
        ]
      },
      {
        "emoji": "🙌",
        "name": "raising hands",
        "keywords": [
          "praise",
          "hooray",
          "celebrate"
        ]
      },
      {
        "emoji": "👐",
        "name": "open hands",
        "keywords": [
          "hug",
          "open",
          "welcome"
        ]
      },
      {
        "emoji": "🤲",
        "name": "palms up together",
        "keywords": [
          "prayer",
          "ask",
          "give"
        ]
      },
      {
        "emoji": "🤝",
        "name": "handshake",
        "keywords": [
          "deal",
          "agree",
          "meeting",
          "friend"
        ]
      },
      {
        "emoji": "🙏",
        "name": "folded hands",
        "keywords": [
          "pray",
          "please",
          "thank you",
          "namaste",
          "hope"
        ]
      },
      {
        "emoji": "✍️",
        "name": "writing hand",
        "keywords": [
          "write",
          "note",
          "pen"
        ]
      },
      {
        "emoji": "💅",
        "name": "nail polish",
        "keywords": [
          "slay",
          "sassy",
          "beauty",
          "done"
        ]
      },
      {
        "emoji": "🤳",
        "name": "selfie",
        "keywords": [
          "camera",
          "photo",
          "phone"
        ]
      },
      {
        "emoji": "💪",
        "name": "flexed biceps",
        "keywords": [
          "strong",
          "muscle",
          "gym",
          "flex",
          "power"
        ]
      },
      {
        "emoji": "🦾",
        "name": "mechanical arm",
        "keywords": [
          "cyborg",
          "robot",
          "arm"
        ]
      },
      {
        "emoji": "🦿",
        "name": "mechanical leg",
        "keywords": [
          "cyborg",
          "robot",
          "leg"
        ]
      },
      {
        "emoji": "🦵",
        "name": "leg",
        "keywords": [
          "kick",
          "limb"
        ]
      },
      {
        "emoji": "🦶",
        "name": "foot",
        "keywords": [
          "feet",
          "kick",
          "step"
        ]
      },
      {
        "emoji": "👂",
        "name": "ear",
        "keywords": [
          "hear",
          "listen"
        ]
      },
      {
        "emoji": "👃",
        "name": "nose",
        "keywords": [
          "smell",
          "sniff"
        ]
      },
      {
        "emoji": "🧠",
        "name": "brain",
        "keywords": [
          "smart",
          "intellect",
          "mind"
        ]
      },
      {
        "emoji": "🫀",
        "name": "anatomical heart",
        "keywords": [
          "heart",
          "pulse",
          "organ"
        ]
      },
      {
        "emoji": "🫁",
        "name": "lungs",
        "keywords": [
          "breathe",
          "air"
        ]
      },
      {
        "emoji": "🦷",
        "name": "tooth",
        "keywords": [
          "dentist",
          "teeth"
        ]
      },
      {
        "emoji": "🦴",
        "name": "bone",
        "keywords": [
          "skeleton"
        ]
      },
      {
        "emoji": "👀",
        "name": "eyes",
        "keywords": [
          "look",
          "watch",
          "peek",
          "sus",
          "spy",
          "see"
        ]
      },
      {
        "emoji": "👁️",
        "name": "eye",
        "keywords": [
          "look",
          "vision",
          "see"
        ]
      },
      {
        "emoji": "👅",
        "name": "tongue",
        "keywords": [
          "taste",
          "lick"
        ]
      },
      {
        "emoji": "👄",
        "name": "mouth",
        "keywords": [
          "lips",
          "kiss"
        ]
      },
      {
        "emoji": "🫦",
        "name": "biting lip",
        "keywords": [
          "anxious",
          "nervous",
          "flirt"
        ]
      },
      {
        "emoji": "👶",
        "name": "baby",
        "keywords": [
          "child",
          "kid",
          "infant"
        ]
      },
      {
        "emoji": "👧",
        "name": "girl",
        "keywords": [
          "female",
          "kid"
        ]
      },
      {
        "emoji": "🧒",
        "name": "child",
        "keywords": [
          "kid",
          "youth"
        ]
      },
      {
        "emoji": "👦",
        "name": "boy",
        "keywords": [
          "male",
          "kid"
        ]
      },
      {
        "emoji": "👩",
        "name": "woman",
        "keywords": [
          "female",
          "adult"
        ]
      },
      {
        "emoji": "🧑",
        "name": "person",
        "keywords": [
          "human",
          "adult"
        ]
      },
      {
        "emoji": "👨",
        "name": "man",
        "keywords": [
          "male",
          "adult"
        ]
      },
      {
        "emoji": "👵",
        "name": "old woman",
        "keywords": [
          "grandma",
          "elder"
        ]
      },
      {
        "emoji": "🧓",
        "name": "older person",
        "keywords": [
          "elder"
        ]
      },
      {
        "emoji": "👴",
        "name": "old man",
        "keywords": [
          "grandpa",
          "elder"
        ]
      },
      {
        "emoji": "🗣️",
        "name": "speaking head",
        "keywords": [
          "talk",
          "shout",
          "speak"
        ]
      },
      {
        "emoji": "👤",
        "name": "bust in silhouette",
        "keywords": [
          "user",
          "person",
          "profile",
          "member"
        ]
      },
      {
        "emoji": "👥",
        "name": "busts in silhouette",
        "keywords": [
          "circle",
          "group",
          "team",
          "family",
          "members"
        ]
      },
      {
        "emoji": "🫂",
        "name": "people hugging",
        "keywords": [
          "hug",
          "care",
          "friends",
          "support"
        ]
      },
      {
        "emoji": "🏃‍♂️",
        "name": "man running",
        "keywords": [
          "run",
          "hurry",
          "omw",
          "fast",
          "sprint"
        ]
      },
      {
        "emoji": "🏃‍♀️",
        "name": "woman running",
        "keywords": [
          "run",
          "hurry",
          "omw",
          "fast"
        ]
      },
      {
        "emoji": "🚶‍♂️",
        "name": "man walking",
        "keywords": [
          "walk",
          "pedestrian",
          "stroll"
        ]
      },
      {
        "emoji": "🚶‍♀️",
        "name": "woman walking",
        "keywords": [
          "walk",
          "pedestrian"
        ]
      },
      {
        "emoji": "🧍",
        "name": "person standing",
        "keywords": [
          "stand",
          "waiting"
        ]
      },
      {
        "emoji": "🧎",
        "name": "person kneeling",
        "keywords": [
          "kneel",
          "rest"
        ]
      },
      {
        "emoji": "💃",
        "name": "woman dancing",
        "keywords": [
          "dance",
          "party",
          "fun"
        ]
      },
      {
        "emoji": "🕺",
        "name": "man dancing",
        "keywords": [
          "dance",
          "party",
          "groove"
        ]
      },
      {
        "emoji": "🧑‍🤝‍🧑",
        "name": "people holding hands",
        "keywords": [
          "couple",
          "friends",
          "circle"
        ]
      },
      {
        "emoji": "👮‍♂️",
        "name": "police officer",
        "keywords": [
          "police",
          "cop",
          "security",
          "law"
        ]
      },
      {
        "emoji": "🕵️‍♂️",
        "name": "detective",
        "keywords": [
          "spy",
          "stealth",
          "investigate",
          "look"
        ]
      },
      {
        "emoji": "💂",
        "name": "guard",
        "keywords": [
          "guard",
          "protect",
          "circleguard"
        ]
      },
      {
        "emoji": "👷",
        "name": "construction worker",
        "keywords": [
          "work",
          "build",
          "helmet"
        ]
      },
      {
        "emoji": "👩‍⚕️",
        "name": "health worker",
        "keywords": [
          "doctor",
          "nurse",
          "hospital",
          "medical"
        ]
      },
      {
        "emoji": "🦸",
        "name": "superhero",
        "keywords": [
          "hero",
          "save",
          "super"
        ]
      },
      {
        "emoji": "🧙",
        "name": "mage",
        "keywords": [
          "wizard",
          "magic"
        ]
      },
      {
        "emoji": "🧚",
        "name": "fairy",
        "keywords": [
          "magic",
          "wings"
        ]
      },
      {
        "emoji": "🧛",
        "name": "vampire",
        "keywords": [
          "dracula",
          "spooky"
        ]
      },
      {
        "emoji": "🧜",
        "name": "merperson",
        "keywords": [
          "mermaid",
          "sea"
        ]
      }
    ]
  },
  {
    "id": "animals",
    "name": "Animals & Nature",
    "icon": "paw-outline",
    "emojis": [
      {
        "emoji": "🐶",
        "name": "dog face",
        "keywords": [
          "puppy",
          "pet",
          "doggo"
        ]
      },
      {
        "emoji": "🐱",
        "name": "cat face",
        "keywords": [
          "kitty",
          "kitten",
          "pet",
          "meow"
        ]
      },
      {
        "emoji": "🐭",
        "name": "mouse face",
        "keywords": [
          "rat",
          "rodent"
        ]
      },
      {
        "emoji": "🐹",
        "name": "hamster",
        "keywords": [
          "pet",
          "cute"
        ]
      },
      {
        "emoji": "🐰",
        "name": "rabbit face",
        "keywords": [
          "bunny",
          "cute",
          "pet"
        ]
      },
      {
        "emoji": "🦊",
        "name": "fox",
        "keywords": [
          "sly",
          "wild"
        ]
      },
      {
        "emoji": "🐻",
        "name": "bear",
        "keywords": [
          "grizzly",
          "wild",
          "teddy"
        ]
      },
      {
        "emoji": "🐼",
        "name": "panda",
        "keywords": [
          "cute",
          "bamboo"
        ]
      },
      {
        "emoji": "🐨",
        "name": "koala",
        "keywords": [
          "australia",
          "cute"
        ]
      },
      {
        "emoji": "🐯",
        "name": "tiger face",
        "keywords": [
          "wild",
          "cat",
          "rawr"
        ]
      },
      {
        "emoji": "🦁",
        "name": "lion",
        "keywords": [
          "king",
          "wild",
          "rawr",
          "brave"
        ]
      },
      {
        "emoji": "🐮",
        "name": "cow face",
        "keywords": [
          "moo",
          "farm"
        ]
      },
      {
        "emoji": "🐷",
        "name": "pig face",
        "keywords": [
          "oink",
          "farm"
        ]
      },
      {
        "emoji": "🐸",
        "name": "frog",
        "keywords": [
          "toad",
          "pepe",
          "ribbit"
        ]
      },
      {
        "emoji": "🐵",
        "name": "monkey face",
        "keywords": [
          "chimp",
          "silly"
        ]
      },
      {
        "emoji": "🙈",
        "name": "see-no-evil monkey",
        "keywords": [
          "monkey",
          "shy",
          "blind"
        ]
      },
      {
        "emoji": "🙉",
        "name": "hear-no-evil monkey",
        "keywords": [
          "monkey",
          "deaf"
        ]
      },
      {
        "emoji": "🙊",
        "name": "speak-no-evil monkey",
        "keywords": [
          "monkey",
          "quiet",
          "secret"
        ]
      },
      {
        "emoji": "🐔",
        "name": "chicken",
        "keywords": [
          "rooster",
          "bird",
          "farm"
        ]
      },
      {
        "emoji": "🐧",
        "name": "penguin",
        "keywords": [
          "antarctica",
          "cold",
          "bird"
        ]
      },
      {
        "emoji": "🐦",
        "name": "bird",
        "keywords": [
          "fly",
          "nature"
        ]
      },
      {
        "emoji": "🐤",
        "name": "baby chick",
        "keywords": [
          "chick",
          "bird",
          "cute"
        ]
      },
      {
        "emoji": "🦆",
        "name": "duck",
        "keywords": [
          "quack",
          "bird"
        ]
      },
      {
        "emoji": "🦅",
        "name": "eagle",
        "keywords": [
          "bird",
          "freedom",
          "fly"
        ]
      },
      {
        "emoji": "🦉",
        "name": "owl",
        "keywords": [
          "night",
          "wise",
          "bird"
        ]
      },
      {
        "emoji": "🦇",
        "name": "bat",
        "keywords": [
          "spooky",
          "night",
          "vampire"
        ]
      },
      {
        "emoji": "🐺",
        "name": "wolf",
        "keywords": [
          "pack",
          "howl",
          "wild"
        ]
      },
      {
        "emoji": "🐗",
        "name": "boar",
        "keywords": [
          "pig",
          "wild"
        ]
      },
      {
        "emoji": "🐴",
        "name": "horse",
        "keywords": [
          "steed",
          "ride"
        ]
      },
      {
        "emoji": "🦄",
        "name": "unicorn",
        "keywords": [
          "magic",
          "fantasy",
          "horse"
        ]
      },
      {
        "emoji": "🐝",
        "name": "honeybee",
        "keywords": [
          "bee",
          "buzz",
          "honey"
        ]
      },
      {
        "emoji": "🪱",
        "name": "worm",
        "keywords": [
          "earthworm",
          "dirt"
        ]
      },
      {
        "emoji": "🐛",
        "name": "bug",
        "keywords": [
          "caterpillar",
          "insect"
        ]
      },
      {
        "emoji": "🦋",
        "name": "butterfly",
        "keywords": [
          "pretty",
          "nature",
          "wings"
        ]
      },
      {
        "emoji": "🐌",
        "name": "snail",
        "keywords": [
          "slow",
          "shell"
        ]
      },
      {
        "emoji": "🐞",
        "name": "lady beetle",
        "keywords": [
          "ladybug",
          "lucky"
        ]
      },
      {
        "emoji": "🐜",
        "name": "ant",
        "keywords": [
          "insect",
          "worker"
        ]
      },
      {
        "emoji": "🪰",
        "name": "fly",
        "keywords": [
          "insect",
          "pest"
        ]
      },
      {
        "emoji": "🪲",
        "name": "beetle",
        "keywords": [
          "bug",
          "insect"
        ]
      },
      {
        "emoji": "🪳",
        "name": "cockroach",
        "keywords": [
          "pest",
          "roach"
        ]
      },
      {
        "emoji": "🦟",
        "name": "mosquito",
        "keywords": [
          "bite",
          "pest"
        ]
      },
      {
        "emoji": "🦗",
        "name": "cricket",
        "keywords": [
          "chirp",
          "grasshopper"
        ]
      },
      {
        "emoji": "🕷️",
        "name": "spider",
        "keywords": [
          "creepy",
          "web"
        ]
      },
      {
        "emoji": "🕸️",
        "name": "spider web",
        "keywords": [
          "web",
          "halloween"
        ]
      },
      {
        "emoji": "🦂",
        "name": "scorpion",
        "keywords": [
          "sting",
          "desert"
        ]
      },
      {
        "emoji": "🐢",
        "name": "turtle",
        "keywords": [
          "slow",
          "tortoise",
          "shell"
        ]
      },
      {
        "emoji": "🐍",
        "name": "snake",
        "keywords": [
          "slither",
          "reptile"
        ]
      },
      {
        "emoji": "🦎",
        "name": "lizard",
        "keywords": [
          "reptile",
          "gecko"
        ]
      },
      {
        "emoji": "🦖",
        "name": "T-Rex",
        "keywords": [
          "dino",
          "dinosaur",
          "rawr"
        ]
      },
      {
        "emoji": "🦕",
        "name": "sauropod",
        "keywords": [
          "dino",
          "dinosaur"
        ]
      },
      {
        "emoji": "🐙",
        "name": "octopus",
        "keywords": [
          "tentacles",
          "sea"
        ]
      },
      {
        "emoji": "🦑",
        "name": "squid",
        "keywords": [
          "sea",
          "calamari"
        ]
      },
      {
        "emoji": "🦐",
        "name": "shrimp",
        "keywords": [
          "seafood",
          "prawn"
        ]
      },
      {
        "emoji": "🦞",
        "name": "lobster",
        "keywords": [
          "crab",
          "seafood"
        ]
      },
      {
        "emoji": "🦀",
        "name": "crab",
        "keywords": [
          "beach",
          "seafood"
        ]
      },
      {
        "emoji": "🐡",
        "name": "blowfish",
        "keywords": [
          "pufferfish",
          "ocean"
        ]
      },
      {
        "emoji": "🐠",
        "name": "tropical fish",
        "keywords": [
          "fish",
          "aquarium"
        ]
      },
      {
        "emoji": "🐟",
        "name": "fish",
        "keywords": [
          "seafood",
          "river"
        ]
      },
      {
        "emoji": "🐬",
        "name": "dolphin",
        "keywords": [
          "ocean",
          "smart"
        ]
      },
      {
        "emoji": "🐳",
        "name": "spouting whale",
        "keywords": [
          "ocean",
          "mammal"
        ]
      },
      {
        "emoji": "🐋",
        "name": "whale",
        "keywords": [
          "ocean",
          "huge"
        ]
      },
      {
        "emoji": "🦈",
        "name": "shark",
        "keywords": [
          "jaw",
          "predator",
          "ocean"
        ]
      },
      {
        "emoji": "🦭",
        "name": "seal",
        "keywords": [
          "sea lion",
          "cute"
        ]
      },
      {
        "emoji": "🐊",
        "name": "crocodile",
        "keywords": [
          "alligator",
          "gator"
        ]
      },
      {
        "emoji": "🐅",
        "name": "tiger",
        "keywords": [
          "wild",
          "predator"
        ]
      },
      {
        "emoji": "🐆",
        "name": "leopard",
        "keywords": [
          "cheetah",
          "fast"
        ]
      },
      {
        "emoji": "🦓",
        "name": "zebra",
        "keywords": [
          "stripes",
          "safari"
        ]
      },
      {
        "emoji": "🦍",
        "name": "gorilla",
        "keywords": [
          "ape",
          "strong"
        ]
      },
      {
        "emoji": "🐘",
        "name": "elephant",
        "keywords": [
          "trunk",
          "safari",
          "mammoth"
        ]
      },
      {
        "emoji": "🦛",
        "name": "hippopotamus",
        "keywords": [
          "hippo",
          "water"
        ]
      },
      {
        "emoji": "🦏",
        "name": "rhinoceros",
        "keywords": [
          "rhino",
          "horn"
        ]
      },
      {
        "emoji": "🐪",
        "name": "camel",
        "keywords": [
          "desert",
          "hump"
        ]
      },
      {
        "emoji": "🦒",
        "name": "giraffe",
        "keywords": [
          "tall",
          "neck"
        ]
      },
      {
        "emoji": "🦘",
        "name": "kangaroo",
        "keywords": [
          "australia",
          "jump"
        ]
      },
      {
        "emoji": "🌸",
        "name": "cherry blossom",
        "keywords": [
          "flower",
          "pink",
          "spring",
          "sakura"
        ]
      },
      {
        "emoji": "🌹",
        "name": "rose",
        "keywords": [
          "flower",
          "red",
          "romance",
          "love"
        ]
      },
      {
        "emoji": "🌻",
        "name": "sunflower",
        "keywords": [
          "flower",
          "summer",
          "sun"
        ]
      },
      {
        "emoji": "🌲",
        "name": "evergreen tree",
        "keywords": [
          "tree",
          "forest",
          "nature",
          "pine"
        ]
      },
      {
        "emoji": "🌴",
        "name": "palm tree",
        "keywords": [
          "beach",
          "tropical",
          "vacation"
        ]
      },
      {
        "emoji": "🍀",
        "name": "four leaf clover",
        "keywords": [
          "lucky",
          "luck",
          "irish",
          "green"
        ]
      },
      {
        "emoji": "🍁",
        "name": "maple leaf",
        "keywords": [
          "autumn",
          "fall",
          "canada"
        ]
      },
      {
        "emoji": "☀️",
        "name": "sun",
        "keywords": [
          "sunny",
          "weather",
          "bright",
          "day"
        ]
      },
      {
        "emoji": "🌙",
        "name": "crescent moon",
        "keywords": [
          "night",
          "sleep",
          "dark",
          "moon"
        ]
      },
      {
        "emoji": "⭐",
        "name": "star",
        "keywords": [
          "gold",
          "favorite",
          "night",
          "shine"
        ]
      },
      {
        "emoji": "⚡",
        "name": "zap",
        "keywords": [
          "lightning",
          "thunder",
          "storm",
          "power"
        ]
      },
      {
        "emoji": "🌈",
        "name": "rainbow",
        "keywords": [
          "pride",
          "color",
          "nature"
        ]
      },
      {
        "emoji": "🌧️",
        "name": "cloud with rain",
        "keywords": [
          "rain",
          "weather",
          "storm"
        ]
      },
      {
        "emoji": "❄️",
        "name": "snowflake",
        "keywords": [
          "cold",
          "snow",
          "winter",
          "ice"
        ]
      },
      {
        "emoji": "🔥",
        "name": "fire",
        "keywords": [
          "flame",
          "lit",
          "hot"
        ]
      }
    ]
  },
  {
    "id": "food",
    "name": "Food & Drink",
    "icon": "fast-food-outline",
    "emojis": [
      {
        "emoji": "🍎",
        "name": "red apple",
        "keywords": [
          "fruit",
          "healthy",
          "food"
        ]
      },
      {
        "emoji": "🍏",
        "name": "green apple",
        "keywords": [
          "fruit",
          "sour"
        ]
      },
      {
        "emoji": "🍐",
        "name": "pear",
        "keywords": [
          "fruit"
        ]
      },
      {
        "emoji": "🍊",
        "name": "tangerine",
        "keywords": [
          "orange",
          "citrus"
        ]
      },
      {
        "emoji": "🍋",
        "name": "lemon",
        "keywords": [
          "citrus",
          "sour"
        ]
      },
      {
        "emoji": "🍌",
        "name": "banana",
        "keywords": [
          "fruit",
          "snack"
        ]
      },
      {
        "emoji": "🍉",
        "name": "watermelon",
        "keywords": [
          "fruit",
          "summer"
        ]
      },
      {
        "emoji": "🍇",
        "name": "grapes",
        "keywords": [
          "fruit",
          "wine"
        ]
      },
      {
        "emoji": "🍓",
        "name": "strawberry",
        "keywords": [
          "fruit",
          "berry"
        ]
      },
      {
        "emoji": "🫐",
        "name": "blueberries",
        "keywords": [
          "fruit",
          "berry"
        ]
      },
      {
        "emoji": "🍈",
        "name": "melon",
        "keywords": [
          "fruit"
        ]
      },
      {
        "emoji": "🍒",
        "name": "cherries",
        "keywords": [
          "fruit",
          "sweet"
        ]
      },
      {
        "emoji": "🍑",
        "name": "peach",
        "keywords": [
          "fruit",
          "butt"
        ]
      },
      {
        "emoji": "🥭",
        "name": "mango",
        "keywords": [
          "fruit",
          "tropical"
        ]
      },
      {
        "emoji": "🍍",
        "name": "pineapple",
        "keywords": [
          "tropical",
          "fruit"
        ]
      },
      {
        "emoji": "🥥",
        "name": "coconut",
        "keywords": [
          "tropical",
          "island"
        ]
      },
      {
        "emoji": "🥝",
        "name": "kiwi fruit",
        "keywords": [
          "fruit"
        ]
      },
      {
        "emoji": "🍅",
        "name": "tomato",
        "keywords": [
          "vegetable",
          "red"
        ]
      },
      {
        "emoji": "🥑",
        "name": "avocado",
        "keywords": [
          "guacamole",
          "healthy"
        ]
      },
      {
        "emoji": "🥦",
        "name": "broccoli",
        "keywords": [
          "vegetable",
          "green"
        ]
      },
      {
        "emoji": "🥒",
        "name": "cucumber",
        "keywords": [
          "pickle",
          "salad"
        ]
      },
      {
        "emoji": "🌶️",
        "name": "hot pepper",
        "keywords": [
          "spicy",
          "chili",
          "hot"
        ]
      },
      {
        "emoji": "🌽",
        "name": "ear of corn",
        "keywords": [
          "corn",
          "maize"
        ]
      },
      {
        "emoji": "🥕",
        "name": "carrot",
        "keywords": [
          "vegetable",
          "orange"
        ]
      },
      {
        "emoji": "🥔",
        "name": "potato",
        "keywords": [
          "fries",
          "spud"
        ]
      },
      {
        "emoji": "🥐",
        "name": "croissant",
        "keywords": [
          "french",
          "pastry",
          "bakery"
        ]
      },
      {
        "emoji": "🥯",
        "name": "bagel",
        "keywords": [
          "bread",
          "breakfast"
        ]
      },
      {
        "emoji": "🍞",
        "name": "bread",
        "keywords": [
          "toast",
          "bakery"
        ]
      },
      {
        "emoji": "🥖",
        "name": "baguette bread",
        "keywords": [
          "french",
          "bread"
        ]
      },
      {
        "emoji": "🥨",
        "name": "pretzel",
        "keywords": [
          "snack",
          "bread"
        ]
      },
      {
        "emoji": "🧀",
        "name": "cheese wedge",
        "keywords": [
          "cheese",
          "cheddar"
        ]
      },
      {
        "emoji": "🥚",
        "name": "egg",
        "keywords": [
          "breakfast",
          "protein"
        ]
      },
      {
        "emoji": "🍳",
        "name": "cooking",
        "keywords": [
          "fried egg",
          "pan",
          "breakfast"
        ]
      },
      {
        "emoji": "🥞",
        "name": "pancakes",
        "keywords": [
          "breakfast",
          "syrup",
          "fluffy"
        ]
      },
      {
        "emoji": "🧇",
        "name": "waffle",
        "keywords": [
          "breakfast",
          "syrup"
        ]
      },
      {
        "emoji": "🥓",
        "name": "bacon",
        "keywords": [
          "breakfast",
          "meat",
          "crispy"
        ]
      },
      {
        "emoji": "🥩",
        "name": "cut of meat",
        "keywords": [
          "steak",
          "beef",
          "dinner"
        ]
      },
      {
        "emoji": "🍗",
        "name": "poultry leg",
        "keywords": [
          "chicken",
          "drumstick"
        ]
      },
      {
        "emoji": "🍖",
        "name": "meat on bone",
        "keywords": [
          "meat",
          "bbq"
        ]
      },
      {
        "emoji": "🌭",
        "name": "hot dog",
        "keywords": [
          "sausage",
          "snack"
        ]
      },
      {
        "emoji": "🍔",
        "name": "hamburger",
        "keywords": [
          "burger",
          "fast food",
          "beef"
        ]
      },
      {
        "emoji": "🍟",
        "name": "french fries",
        "keywords": [
          "fries",
          "chips",
          "snack"
        ]
      },
      {
        "emoji": "🍕",
        "name": "pizza",
        "keywords": [
          "food",
          "cheese",
          "slice",
          "dinner"
        ]
      },
      {
        "emoji": "🥪",
        "name": "sandwich",
        "keywords": [
          "lunch",
          "bread"
        ]
      },
      {
        "emoji": "🥙",
        "name": "stuffed flatbread",
        "keywords": [
          "gyro",
          "shawarma",
          "falafel"
        ]
      },
      {
        "emoji": "🌮",
        "name": "taco",
        "keywords": [
          "mexican",
          "food"
        ]
      },
      {
        "emoji": "🌯",
        "name": "burrito",
        "keywords": [
          "wrap",
          "mexican"
        ]
      },
      {
        "emoji": "🥗",
        "name": "green salad",
        "keywords": [
          "healthy",
          "vegetables"
        ]
      },
      {
        "emoji": "🍿",
        "name": "popcorn",
        "keywords": [
          "movie",
          "snack",
          "drama"
        ]
      },
      {
        "emoji": "🍝",
        "name": "spaghetti",
        "keywords": [
          "pasta",
          "italian",
          "noodles"
        ]
      },
      {
        "emoji": "🍜",
        "name": "steaming bowl",
        "keywords": [
          "ramen",
          "noodles",
          "soup"
        ]
      },
      {
        "emoji": "🍲",
        "name": "pot of food",
        "keywords": [
          "stew",
          "curry",
          "soup"
        ]
      },
      {
        "emoji": "🍛",
        "name": "curry rice",
        "keywords": [
          "curry",
          "indian",
          "dinner"
        ]
      },
      {
        "emoji": "🍣",
        "name": "sushi",
        "keywords": [
          "japanese",
          "fish",
          "rice"
        ]
      },
      {
        "emoji": "🍱",
        "name": "bento box",
        "keywords": [
          "lunch",
          "japanese"
        ]
      },
      {
        "emoji": "🥟",
        "name": "dumpling",
        "keywords": [
          "dim sum",
          "chinese"
        ]
      },
      {
        "emoji": "🍦",
        "name": "soft ice cream",
        "keywords": [
          "ice cream",
          "dessert",
          "sweet"
        ]
      },
      {
        "emoji": "🍨",
        "name": "ice cream",
        "keywords": [
          "dessert",
          "gelato",
          "sweet"
        ]
      },
      {
        "emoji": "🍩",
        "name": "doughnut",
        "keywords": [
          "donut",
          "sweet",
          "bakery"
        ]
      },
      {
        "emoji": "🍪",
        "name": "cookie",
        "keywords": [
          "biscuit",
          "chocolate chip",
          "sweet"
        ]
      },
      {
        "emoji": "🎂",
        "name": "birthday cake",
        "keywords": [
          "cake",
          "celebration",
          "party"
        ]
      },
      {
        "emoji": "🍰",
        "name": "shortcake",
        "keywords": [
          "cake",
          "slice",
          "dessert"
        ]
      },
      {
        "emoji": "🧁",
        "name": "cupcake",
        "keywords": [
          "sweet",
          "bakery"
        ]
      },
      {
        "emoji": "🍫",
        "name": "chocolate bar",
        "keywords": [
          "candy",
          "sweet"
        ]
      },
      {
        "emoji": "🍬",
        "name": "candy",
        "keywords": [
          "sweet",
          "sugar"
        ]
      },
      {
        "emoji": "🍭",
        "name": "lollipop",
        "keywords": [
          "candy",
          "sweet"
        ]
      },
      {
        "emoji": "☕",
        "name": "hot beverage",
        "keywords": [
          "coffee",
          "tea",
          "cafe",
          "morning"
        ]
      },
      {
        "emoji": "🧋",
        "name": "bubble tea",
        "keywords": [
          "boba",
          "tea",
          "milk tea"
        ]
      },
      {
        "emoji": "🍵",
        "name": "teacup without handle",
        "keywords": [
          "green tea",
          "matcha"
        ]
      },
      {
        "emoji": "🥤",
        "name": "cup with straw",
        "keywords": [
          "soda",
          "drink",
          "juice"
        ]
      },
      {
        "emoji": "🧃",
        "name": "beverage box",
        "keywords": [
          "juice box",
          "drink"
        ]
      },
      {
        "emoji": "🍺",
        "name": "beer mug",
        "keywords": [
          "beer",
          "drink",
          "pub",
          "cheers"
        ]
      },
      {
        "emoji": "🍻",
        "name": "clinking beer mugs",
        "keywords": [
          "cheers",
          "beers",
          "party"
        ]
      },
      {
        "emoji": "🥂",
        "name": "clinking glasses",
        "keywords": [
          "champagne",
          "toast",
          "celebrate"
        ]
      },
      {
        "emoji": "🍷",
        "name": "wine glass",
        "keywords": [
          "wine",
          "drink",
          "dinner"
        ]
      },
      {
        "emoji": "🥃",
        "name": "tumbler glass",
        "keywords": [
          "whiskey",
          "liquor",
          "bourbon"
        ]
      },
      {
        "emoji": "🍸",
        "name": "cocktail glass",
        "keywords": [
          "martini",
          "bar",
          "drink"
        ]
      },
      {
        "emoji": "🍹",
        "name": "tropical drink",
        "keywords": [
          "cocktail",
          "vacation",
          "summer"
        ]
      }
    ]
  },
  {
    "id": "travel",
    "name": "Travel, Maps & Safety",
    "icon": "navigate-outline",
    "emojis": [
      {
        "emoji": "📍",
        "name": "round pushpin",
        "keywords": [
          "location",
          "pin",
          "gps",
          "map",
          "spot",
          "here"
        ]
      },
      {
        "emoji": "🗺️",
        "name": "world map",
        "keywords": [
          "map",
          "travel",
          "navigation",
          "world"
        ]
      },
      {
        "emoji": "🧭",
        "name": "compass",
        "keywords": [
          "direction",
          "navigate",
          "explore",
          "bearing"
        ]
      },
      {
        "emoji": "🚗",
        "name": "automobile",
        "keywords": [
          "car",
          "drive",
          "trip",
          "commute",
          "driving"
        ]
      },
      {
        "emoji": "🚙",
        "name": "sport utility vehicle",
        "keywords": [
          "suv",
          "car",
          "travel"
        ]
      },
      {
        "emoji": "🏎️",
        "name": "racing car",
        "keywords": [
          "speed",
          "fast",
          "race",
          "speeding"
        ]
      },
      {
        "emoji": "🚓",
        "name": "police car",
        "keywords": [
          "police",
          "emergency",
          "cop",
          "siren"
        ]
      },
      {
        "emoji": "🚑",
        "name": "ambulance",
        "keywords": [
          "medical",
          "hospital",
          "emergency",
          "rescue"
        ]
      },
      {
        "emoji": "🚒",
        "name": "fire engine",
        "keywords": [
          "fire",
          "truck",
          "emergency"
        ]
      },
      {
        "emoji": "🚐",
        "name": "minibus",
        "keywords": [
          "van",
          "travel",
          "bus"
        ]
      },
      {
        "emoji": "🛻",
        "name": "pickup truck",
        "keywords": [
          "truck",
          "car"
        ]
      },
      {
        "emoji": "🚚",
        "name": "delivery truck",
        "keywords": [
          "delivery",
          "shipping"
        ]
      },
      {
        "emoji": "🏍️",
        "name": "motorcycle",
        "keywords": [
          "bike",
          "ride",
          "motorbike"
        ]
      },
      {
        "emoji": "🛵",
        "name": "motor scooter",
        "keywords": [
          "scooter",
          "vespa",
          "delivery"
        ]
      },
      {
        "emoji": "🚲",
        "name": "bicycle",
        "keywords": [
          "bike",
          "ride",
          "cycling"
        ]
      },
      {
        "emoji": "🛴",
        "name": "kick scooter",
        "keywords": [
          "scooter",
          "ride"
        ]
      },
      {
        "emoji": "🚨",
        "name": "police car light",
        "keywords": [
          "siren",
          "alert",
          "emergency",
          "sos",
          "danger",
          "alarm"
        ]
      },
      {
        "emoji": "🛡️",
        "name": "shield",
        "keywords": [
          "security",
          "guard",
          "protect",
          "safe",
          "circleguard"
        ]
      },
      {
        "emoji": "⚡",
        "name": "high voltage",
        "keywords": [
          "flash",
          "fast",
          "lightning",
          "energy",
          "power"
        ]
      },
      {
        "emoji": "🪫",
        "name": "low battery",
        "keywords": [
          "battery",
          "dead",
          "charge",
          "empty",
          "power"
        ]
      },
      {
        "emoji": "🔋",
        "name": "battery",
        "keywords": [
          "power",
          "charge",
          "full"
        ]
      },
      {
        "emoji": "⛽",
        "name": "fuel pump",
        "keywords": [
          "gas",
          "petrol",
          "station"
        ]
      },
      {
        "emoji": "🛑",
        "name": "stop sign",
        "keywords": [
          "stop",
          "halt",
          "red"
        ]
      },
      {
        "emoji": "🚦",
        "name": "traffic light",
        "keywords": [
          "light",
          "signal",
          "drive"
        ]
      },
      {
        "emoji": "🚧",
        "name": "construction",
        "keywords": [
          "barrier",
          "roadwork",
          "caution"
        ]
      },
      {
        "emoji": "🏁",
        "name": "chequered flag",
        "keywords": [
          "finish",
          "destination",
          "arrived",
          "done"
        ]
      },
      {
        "emoji": "🚩",
        "name": "triangular flag",
        "keywords": [
          "flag",
          "landmark",
          "post"
        ]
      },
      {
        "emoji": "🏠",
        "name": "house",
        "keywords": [
          "home",
          "safe zone",
          "residence",
          "family"
        ]
      },
      {
        "emoji": "🏡",
        "name": "house with garden",
        "keywords": [
          "home",
          "suburbs",
          "house"
        ]
      },
      {
        "emoji": "🏢",
        "name": "office building",
        "keywords": [
          "work",
          "job",
          "business"
        ]
      },
      {
        "emoji": "🏫",
        "name": "school",
        "keywords": [
          "education",
          "college",
          "study",
          "class"
        ]
      },
      {
        "emoji": "🏥",
        "name": "hospital",
        "keywords": [
          "doctor",
          "emergency",
          "medical"
        ]
      },
      {
        "emoji": "🏪",
        "name": "convenience store",
        "keywords": [
          "shop",
          "store",
          "market"
        ]
      },
      {
        "emoji": "🏨",
        "name": "hotel",
        "keywords": [
          "stay",
          "vacation",
          "trip"
        ]
      },
      {
        "emoji": "✈️",
        "name": "airplane",
        "keywords": [
          "flight",
          "travel",
          "trip",
          "airport"
        ]
      },
      {
        "emoji": "🛫",
        "name": "airplane departure",
        "keywords": [
          "takeoff",
          "leave",
          "fly"
        ]
      },
      {
        "emoji": "🛬",
        "name": "airplane arrival",
        "keywords": [
          "landing",
          "arrived",
          "touchdown"
        ]
      },
      {
        "emoji": "🚀",
        "name": "rocket",
        "keywords": [
          "speed",
          "launch",
          "fast",
          "space",
          "omw"
        ]
      },
      {
        "emoji": "🛸",
        "name": "flying saucer",
        "keywords": [
          "ufo",
          "alien",
          "mystery"
        ]
      },
      {
        "emoji": "🚁",
        "name": "helicopter",
        "keywords": [
          "chopper",
          "air",
          "fly"
        ]
      },
      {
        "emoji": "🚆",
        "name": "train",
        "keywords": [
          "rail",
          "transit",
          "subway"
        ]
      },
      {
        "emoji": "🚇",
        "name": "metro",
        "keywords": [
          "subway",
          "tube",
          "transit"
        ]
      },
      {
        "emoji": "🛳️",
        "name": "passenger ship",
        "keywords": [
          "cruise",
          "boat",
          "ocean"
        ]
      },
      {
        "emoji": "🏖️",
        "name": "beach with umbrella",
        "keywords": [
          "beach",
          "vacation",
          "ocean",
          "summer"
        ]
      },
      {
        "emoji": "🏔️",
        "name": "snow-capped mountain",
        "keywords": [
          "mountain",
          "hike",
          "nature"
        ]
      },
      {
        "emoji": "⛺",
        "name": "tent",
        "keywords": [
          "camp",
          "outdoor",
          "nature"
        ]
      }
    ]
  },
  {
    "id": "activities",
    "name": "Activities & Gaming",
    "icon": "game-controller-outline",
    "emojis": [
      {
        "emoji": "⚽",
        "name": "soccer ball",
        "keywords": [
          "football",
          "sport",
          "game"
        ]
      },
      {
        "emoji": "🏀",
        "name": "basketball",
        "keywords": [
          "sport",
          "nba",
          "ball"
        ]
      },
      {
        "emoji": "🏈",
        "name": "american football",
        "keywords": [
          "sport",
          "nfl"
        ]
      },
      {
        "emoji": "⚾",
        "name": "baseball",
        "keywords": [
          "sport",
          "mlb"
        ]
      },
      {
        "emoji": "🥎",
        "name": "softball",
        "keywords": [
          "sport",
          "ball"
        ]
      },
      {
        "emoji": "🎾",
        "name": "tennis",
        "keywords": [
          "racket",
          "sport"
        ]
      },
      {
        "emoji": "🏐",
        "name": "volleyball",
        "keywords": [
          "beach",
          "sport"
        ]
      },
      {
        "emoji": "🏉",
        "name": "rugby football",
        "keywords": [
          "sport"
        ]
      },
      {
        "emoji": "🥏",
        "name": "flying disc",
        "keywords": [
          "frisbee",
          "park"
        ]
      },
      {
        "emoji": "🎱",
        "name": "pool 8 ball",
        "keywords": [
          "billiards",
          "game"
        ]
      },
      {
        "emoji": "🏓",
        "name": "ping pong",
        "keywords": [
          "table tennis",
          "paddle"
        ]
      },
      {
        "emoji": "🏸",
        "name": "badminton",
        "keywords": [
          "racket",
          "shuttlecock"
        ]
      },
      {
        "emoji": "🥊",
        "name": "boxing glove",
        "keywords": [
          "fight",
          "punch",
          "box"
        ]
      },
      {
        "emoji": "🥋",
        "name": "martial arts uniform",
        "keywords": [
          "karate",
          "judo"
        ]
      },
      {
        "emoji": "🛹",
        "name": "skateboard",
        "keywords": [
          "skate",
          "board",
          "ride"
        ]
      },
      {
        "emoji": "🛼",
        "name": "roller skate",
        "keywords": [
          "skating",
          "retro"
        ]
      },
      {
        "emoji": "⛸️",
        "name": "ice skate",
        "keywords": [
          "winter",
          "ice"
        ]
      },
      {
        "emoji": "🎿",
        "name": "skis",
        "keywords": [
          "snow",
          "mountain",
          "winter"
        ]
      },
      {
        "emoji": "🏂",
        "name": "snowboarder",
        "keywords": [
          "snow",
          "winter"
        ]
      },
      {
        "emoji": "🏆",
        "name": "trophy",
        "keywords": [
          "winner",
          "champion",
          "first",
          "gold"
        ]
      },
      {
        "emoji": "🥇",
        "name": "1st place medal",
        "keywords": [
          "gold",
          "first",
          "winner"
        ]
      },
      {
        "emoji": "🥈",
        "name": "2nd place medal",
        "keywords": [
          "silver",
          "second"
        ]
      },
      {
        "emoji": "🥉",
        "name": "3rd place medal",
        "keywords": [
          "bronze",
          "third"
        ]
      },
      {
        "emoji": "🏅",
        "name": "sports medal",
        "keywords": [
          "award",
          "honor"
        ]
      },
      {
        "emoji": "🎖️",
        "name": "military medal",
        "keywords": [
          "medal",
          "veteran"
        ]
      },
      {
        "emoji": "🎟️",
        "name": "admission tickets",
        "keywords": [
          "ticket",
          "cinema",
          "movie"
        ]
      },
      {
        "emoji": "🎫",
        "name": "ticket",
        "keywords": [
          "pass",
          "concert"
        ]
      },
      {
        "emoji": "🎪",
        "name": "circus tent",
        "keywords": [
          "circus",
          "show"
        ]
      },
      {
        "emoji": "🎭",
        "name": "performing arts",
        "keywords": [
          "theater",
          "drama",
          "acting"
        ]
      },
      {
        "emoji": "🎨",
        "name": "artist palette",
        "keywords": [
          "art",
          "paint",
          "draw"
        ]
      },
      {
        "emoji": "🎬",
        "name": "clapper board",
        "keywords": [
          "movie",
          "film",
          "cinema"
        ]
      },
      {
        "emoji": "🎤",
        "name": "microphone",
        "keywords": [
          "sing",
          "karaoke",
          "voice"
        ]
      },
      {
        "emoji": "🎧",
        "name": "headphone",
        "keywords": [
          "music",
          "audio",
          "sound",
          "listen"
        ]
      },
      {
        "emoji": "🎼",
        "name": "musical score",
        "keywords": [
          "music",
          "notes"
        ]
      },
      {
        "emoji": "🎹",
        "name": "musical keyboard",
        "keywords": [
          "piano",
          "instrument"
        ]
      },
      {
        "emoji": "🥁",
        "name": "drum",
        "keywords": [
          "drums",
          "beat"
        ]
      },
      {
        "emoji": "🎷",
        "name": "saxophone",
        "keywords": [
          "jazz",
          "music"
        ]
      },
      {
        "emoji": "🎺",
        "name": "trumpet",
        "keywords": [
          "brass",
          "music"
        ]
      },
      {
        "emoji": "🎸",
        "name": "guitar",
        "keywords": [
          "rock",
          "acoustic",
          "music"
        ]
      },
      {
        "emoji": "🎻",
        "name": "violin",
        "keywords": [
          "classical",
          "strings"
        ]
      },
      {
        "emoji": "🎲",
        "name": "game die",
        "keywords": [
          "dice",
          "luck",
          "board game"
        ]
      },
      {
        "emoji": "♟️",
        "name": "chess pawn",
        "keywords": [
          "chess",
          "strategy",
          "game"
        ]
      },
      {
        "emoji": "🎯",
        "name": "bullseye",
        "keywords": [
          "target",
          "dart",
          "hit",
          "accurate"
        ]
      },
      {
        "emoji": "🎳",
        "name": "bowling",
        "keywords": [
          "strike",
          "pins"
        ]
      },
      {
        "emoji": "🎮",
        "name": "video game",
        "keywords": [
          "gaming",
          "controller",
          "playstation",
          "xbox"
        ]
      },
      {
        "emoji": "🎰",
        "name": "slot machine",
        "keywords": [
          "casino",
          "vegas",
          "lucky"
        ]
      },
      {
        "emoji": "🧩",
        "name": "puzzle piece",
        "keywords": [
          "jigsaw",
          "clue"
        ]
      }
    ]
  },
  {
    "id": "objects",
    "name": "Objects & Tech",
    "icon": "cube-outline",
    "emojis": [
      {
        "emoji": "📱",
        "name": "mobile phone",
        "keywords": [
          "iphone",
          "android",
          "cell",
          "call",
          "screen"
        ]
      },
      {
        "emoji": "📲",
        "name": "mobile phone with arrow",
        "keywords": [
          "call",
          "message",
          "phone"
        ]
      },
      {
        "emoji": "☎️",
        "name": "telephone",
        "keywords": [
          "phone",
          "landline"
        ]
      },
      {
        "emoji": "📞",
        "name": "telephone receiver",
        "keywords": [
          "call",
          "phone"
        ]
      },
      {
        "emoji": "💻",
        "name": "laptop",
        "keywords": [
          "computer",
          "macbook",
          "work",
          "code"
        ]
      },
      {
        "emoji": "🖥️",
        "name": "desktop computer",
        "keywords": [
          "pc",
          "screen"
        ]
      },
      {
        "emoji": "🖨️",
        "name": "printer",
        "keywords": [
          "paper",
          "office"
        ]
      },
      {
        "emoji": "⌨️",
        "name": "keyboard",
        "keywords": [
          "typing",
          "keys"
        ]
      },
      {
        "emoji": "🖱️",
        "name": "computer mouse",
        "keywords": [
          "click",
          "pc"
        ]
      },
      {
        "emoji": "⌚",
        "name": "watch",
        "keywords": [
          "time",
          "apple watch",
          "clock"
        ]
      },
      {
        "emoji": "⏰",
        "name": "alarm clock",
        "keywords": [
          "time",
          "morning",
          "wake up",
          "late"
        ]
      },
      {
        "emoji": "🔑",
        "name": "key",
        "keywords": [
          "lock",
          "door",
          "access",
          "secret"
        ]
      },
      {
        "emoji": "🔒",
        "name": "locked",
        "keywords": [
          "secure",
          "privacy",
          "safe",
          "lock"
        ]
      },
      {
        "emoji": "🔓",
        "name": "unlocked",
        "keywords": [
          "open",
          "free"
        ]
      },
      {
        "emoji": "💰",
        "name": "money bag",
        "keywords": [
          "cash",
          "dollar",
          "rich",
          "wealth"
        ]
      },
      {
        "emoji": "💵",
        "name": "dollar banknote",
        "keywords": [
          "money",
          "cash",
          "usd"
        ]
      },
      {
        "emoji": "💸",
        "name": "money with wings",
        "keywords": [
          "spent",
          "flying money",
          "rich"
        ]
      },
      {
        "emoji": "💳",
        "name": "credit card",
        "keywords": [
          "payment",
          "buy",
          "money"
        ]
      },
      {
        "emoji": "💎",
        "name": "gem stone",
        "keywords": [
          "diamond",
          "luxury",
          "precious",
          "jewelry"
        ]
      },
      {
        "emoji": "💡",
        "name": "light bulb",
        "keywords": [
          "idea",
          "bright",
          "smart",
          "think"
        ]
      },
      {
        "emoji": "🔦",
        "name": "flashlight",
        "keywords": [
          "light",
          "torch",
          "dark"
        ]
      },
      {
        "emoji": "📦",
        "name": "package",
        "keywords": [
          "box",
          "delivery",
          "amazon",
          "parcel"
        ]
      },
      {
        "emoji": "🎁",
        "name": "wrapped gift",
        "keywords": [
          "present",
          "birthday",
          "surprise"
        ]
      },
      {
        "emoji": "🎉",
        "name": "party popper",
        "keywords": [
          "tada",
          "celebrate",
          "congrats",
          "party"
        ]
      },
      {
        "emoji": "🎊",
        "name": "confetti ball",
        "keywords": [
          "party",
          "celebration"
        ]
      },
      {
        "emoji": "📷",
        "name": "camera",
        "keywords": [
          "photo",
          "picture",
          "snapshot"
        ]
      },
      {
        "emoji": "📸",
        "name": "camera with flash",
        "keywords": [
          "photo",
          "snap"
        ]
      },
      {
        "emoji": "📹",
        "name": "video camera",
        "keywords": [
          "video",
          "film"
        ]
      },
      {
        "emoji": "🔍",
        "name": "magnifying glass left",
        "keywords": [
          "search",
          "find",
          "detect"
        ]
      },
      {
        "emoji": "🔎",
        "name": "magnifying glass right",
        "keywords": [
          "search",
          "find"
        ]
      },
      {
        "emoji": "🔔",
        "name": "bell",
        "keywords": [
          "notification",
          "alert",
          "ring"
        ]
      },
      {
        "emoji": "🔕",
        "name": "bell with slash",
        "keywords": [
          "mute",
          "silent",
          "quiet"
        ]
      },
      {
        "emoji": "📣",
        "name": "megaphone",
        "keywords": [
          "announcement",
          "shout",
          "broadcast"
        ]
      },
      {
        "emoji": "📢",
        "name": "loudspeaker",
        "keywords": [
          "sound",
          "shout"
        ]
      },
      {
        "emoji": "✉️",
        "name": "envelope",
        "keywords": [
          "mail",
          "letter",
          "email"
        ]
      },
      {
        "emoji": "📧",
        "name": "e-mail",
        "keywords": [
          "email",
          "letter"
        ]
      },
      {
        "emoji": "📩",
        "name": "envelope with arrow",
        "keywords": [
          "incoming",
          "mail"
        ]
      },
      {
        "emoji": "📝",
        "name": "memo",
        "keywords": [
          "note",
          "write",
          "paper"
        ]
      },
      {
        "emoji": "💼",
        "name": "briefcase",
        "keywords": [
          "work",
          "business",
          "job"
        ]
      },
      {
        "emoji": "📁",
        "name": "file folder",
        "keywords": [
          "files",
          "directory"
        ]
      },
      {
        "emoji": "📂",
        "name": "open file folder",
        "keywords": [
          "folder",
          "documents"
        ]
      },
      {
        "emoji": "📅",
        "name": "calendar",
        "keywords": [
          "date",
          "schedule"
        ]
      },
      {
        "emoji": "📌",
        "name": "pushpin",
        "keywords": [
          "pin",
          "board"
        ]
      },
      {
        "emoji": "📎",
        "name": "paperclip",
        "keywords": [
          "attachment",
          "document"
        ]
      },
      {
        "emoji": "✂️",
        "name": "scissors",
        "keywords": [
          "cut",
          "snip"
        ]
      },
      {
        "emoji": "🔨",
        "name": "hammer",
        "keywords": [
          "tool",
          "build",
          "fix"
        ]
      },
      {
        "emoji": "🔧",
        "name": "wrench",
        "keywords": [
          "tool",
          "fix",
          "mechanic"
        ]
      },
      {
        "emoji": "🪛",
        "name": "screwdriver",
        "keywords": [
          "tool",
          "repair"
        ]
      },
      {
        "emoji": "⚙️",
        "name": "gear",
        "keywords": [
          "settings",
          "cog",
          "mechanical"
        ]
      },
      {
        "emoji": "🧰",
        "name": "toolbox",
        "keywords": [
          "tools",
          "kit"
        ]
      },
      {
        "emoji": "🧲",
        "name": "magnet",
        "keywords": [
          "attract",
          "physics"
        ]
      }
    ]
  },
  {
    "id": "symbols",
    "name": "Symbols & Safety",
    "icon": "heart-outline",
    "emojis": [
      {
        "emoji": "❤️",
        "name": "red heart",
        "keywords": [
          "love",
          "heart",
          "romantic",
          "like"
        ]
      },
      {
        "emoji": "🧡",
        "name": "orange heart",
        "keywords": [
          "love",
          "heart",
          "warm"
        ]
      },
      {
        "emoji": "💛",
        "name": "yellow heart",
        "keywords": [
          "love",
          "friendship",
          "gold"
        ]
      },
      {
        "emoji": "💚",
        "name": "green heart",
        "keywords": [
          "love",
          "nature",
          "safe"
        ]
      },
      {
        "emoji": "💙",
        "name": "blue heart",
        "keywords": [
          "love",
          "peace",
          "calm"
        ]
      },
      {
        "emoji": "💜",
        "name": "purple heart",
        "keywords": [
          "love",
          "luxury",
          "royal"
        ]
      },
      {
        "emoji": "🖤",
        "name": "black heart",
        "keywords": [
          "dark",
          "goth",
          "love"
        ]
      },
      {
        "emoji": "🤍",
        "name": "white heart",
        "keywords": [
          "pure",
          "peace",
          "love"
        ]
      },
      {
        "emoji": "🤎",
        "name": "brown heart",
        "keywords": [
          "warm",
          "coffee",
          "earth"
        ]
      },
      {
        "emoji": "💔",
        "name": "broken heart",
        "keywords": [
          "heartbreak",
          "sad",
          "breakup"
        ]
      },
      {
        "emoji": "❤️‍🔥",
        "name": "heart on fire",
        "keywords": [
          "passion",
          "fire",
          "hot",
          "love"
        ]
      },
      {
        "emoji": "❤️‍🩹",
        "name": "mending heart",
        "keywords": [
          "heal",
          "recover",
          "better"
        ]
      },
      {
        "emoji": "💖",
        "name": "sparkling heart",
        "keywords": [
          "sparkle",
          "love",
          "glitter"
        ]
      },
      {
        "emoji": "💗",
        "name": "growing heart",
        "keywords": [
          "love",
          "pulse",
          "crush"
        ]
      },
      {
        "emoji": "💓",
        "name": "beating heart",
        "keywords": [
          "heartbeat",
          "alive",
          "love"
        ]
      },
      {
        "emoji": "💞",
        "name": "revolving hearts",
        "keywords": [
          "love",
          "sweet",
          "romance"
        ]
      },
      {
        "emoji": "💕",
        "name": "two hearts",
        "keywords": [
          "love",
          "affection",
          "bff"
        ]
      },
      {
        "emoji": "💘",
        "name": "heart with arrow",
        "keywords": [
          "cupid",
          "crush",
          "fall in love"
        ]
      },
      {
        "emoji": "💝",
        "name": "heart with ribbon",
        "keywords": [
          "gift",
          "present",
          "love"
        ]
      },
      {
        "emoji": "💟",
        "name": "heart decoration",
        "keywords": [
          "love",
          "purple"
        ]
      },
      {
        "emoji": "☮️",
        "name": "peace symbol",
        "keywords": [
          "peace",
          "hippie"
        ]
      },
      {
        "emoji": "✝️",
        "name": "latin cross",
        "keywords": [
          "christian",
          "faith"
        ]
      },
      {
        "emoji": "☪️",
        "name": "star and crescent",
        "keywords": [
          "islam",
          "muslim"
        ]
      },
      {
        "emoji": "🕉️",
        "name": "om",
        "keywords": [
          "hindu",
          "meditation"
        ]
      },
      {
        "emoji": "☸️",
        "name": "wheel of dharma",
        "keywords": [
          "buddhist"
        ]
      },
      {
        "emoji": "✡️",
        "name": "star of david",
        "keywords": [
          "jewish",
          "judaism"
        ]
      },
      {
        "emoji": "🔯",
        "name": "dotted six-pointed star",
        "keywords": [
          "star"
        ]
      },
      {
        "emoji": "🕎",
        "name": "menorah",
        "keywords": [
          "hanukkah"
        ]
      },
      {
        "emoji": "☯️",
        "name": "yin yang",
        "keywords": [
          "balance",
          "zen"
        ]
      },
      {
        "emoji": "☦️",
        "name": "orthodox cross",
        "keywords": [
          "christian"
        ]
      },
      {
        "emoji": "🛐",
        "name": "place of worship",
        "keywords": [
          "pray",
          "faith"
        ]
      },
      {
        "emoji": "♈",
        "name": "Aries",
        "keywords": [
          "zodiac",
          "ram"
        ]
      },
      {
        "emoji": "♉",
        "name": "Taurus",
        "keywords": [
          "zodiac",
          "bull"
        ]
      },
      {
        "emoji": "♊",
        "name": "Gemini",
        "keywords": [
          "zodiac",
          "twins"
        ]
      },
      {
        "emoji": "♋",
        "name": "Cancer",
        "keywords": [
          "zodiac",
          "crab"
        ]
      },
      {
        "emoji": "♌",
        "name": "Leo",
        "keywords": [
          "zodiac",
          "lion"
        ]
      },
      {
        "emoji": "♍",
        "name": "Virgo",
        "keywords": [
          "zodiac"
        ]
      },
      {
        "emoji": "♎",
        "name": "Libra",
        "keywords": [
          "zodiac",
          "scales"
        ]
      },
      {
        "emoji": "♏",
        "name": "Scorpio",
        "keywords": [
          "zodiac",
          "scorpion"
        ]
      },
      {
        "emoji": "♐",
        "name": "Sagittarius",
        "keywords": [
          "zodiac",
          "archer"
        ]
      },
      {
        "emoji": "♑",
        "name": "Capricorn",
        "keywords": [
          "zodiac",
          "goat"
        ]
      },
      {
        "emoji": "♒",
        "name": "Aquarius",
        "keywords": [
          "zodiac",
          "water"
        ]
      },
      {
        "emoji": "♓",
        "name": "Pisces",
        "keywords": [
          "zodiac",
          "fish"
        ]
      },
      {
        "emoji": "🆔",
        "name": "ID button",
        "keywords": [
          "identity",
          "badge"
        ]
      },
      {
        "emoji": "☢️",
        "name": "radioactive",
        "keywords": [
          "nuclear",
          "danger"
        ]
      },
      {
        "emoji": "☣️",
        "name": "biohazard",
        "keywords": [
          "hazard",
          "danger"
        ]
      },
      {
        "emoji": "📴",
        "name": "mobile phone off",
        "keywords": [
          "silent",
          "off"
        ]
      },
      {
        "emoji": "📳",
        "name": "vibration mode",
        "keywords": [
          "phone",
          "vibrate"
        ]
      },
      {
        "emoji": "🆘",
        "name": "SOS button",
        "keywords": [
          "emergency",
          "help",
          "sos",
          "danger"
        ]
      },
      {
        "emoji": "❌",
        "name": "cross mark",
        "keywords": [
          "no",
          "cancel",
          "wrong",
          "x"
        ]
      },
      {
        "emoji": "⭕",
        "name": "heavy large circle",
        "keywords": [
          "circle",
          "o"
        ]
      },
      {
        "emoji": "🛑",
        "name": "stop sign",
        "keywords": [
          "stop",
          "halt"
        ]
      },
      {
        "emoji": "⛔",
        "name": "no entry",
        "keywords": [
          "forbidden",
          "stop",
          "restricted"
        ]
      },
      {
        "emoji": "📛",
        "name": "name badge",
        "keywords": [
          "badge",
          "tag"
        ]
      },
      {
        "emoji": "🚫",
        "name": "prohibited",
        "keywords": [
          "no",
          "banned"
        ]
      },
      {
        "emoji": "💯",
        "name": "hundred points",
        "keywords": [
          "perfect",
          "score",
          "100",
          "full"
        ]
      },
      {
        "emoji": "💢",
        "name": "anger symbol",
        "keywords": [
          "mad",
          "vein"
        ]
      },
      {
        "emoji": "♨️",
        "name": "hot springs",
        "keywords": [
          "bath",
          "steam"
        ]
      },
      {
        "emoji": "❗",
        "name": "exclamation mark",
        "keywords": [
          "urgent",
          "important",
          "alert"
        ]
      },
      {
        "emoji": "❕",
        "name": "white exclamation mark",
        "keywords": [
          "alert"
        ]
      },
      {
        "emoji": "❓",
        "name": "question mark",
        "keywords": [
          "what",
          "confused",
          "help"
        ]
      },
      {
        "emoji": "❔",
        "name": "white question mark",
        "keywords": [
          "help",
          "ask"
        ]
      },
      {
        "emoji": "‼️",
        "name": "double exclamation mark",
        "keywords": [
          "urgent",
          "alert"
        ]
      },
      {
        "emoji": "⁉️",
        "name": "exclamation question mark",
        "keywords": [
          "what",
          "shock"
        ]
      },
      {
        "emoji": "⚠️",
        "name": "warning",
        "keywords": [
          "caution",
          "danger",
          "alert",
          "watch out"
        ]
      },
      {
        "emoji": "🚸",
        "name": "children crossing",
        "keywords": [
          "kids",
          "caution",
          "school"
        ]
      },
      {
        "emoji": "♻️",
        "name": "recycling symbol",
        "keywords": [
          "green",
          "recycle"
        ]
      },
      {
        "emoji": "✅",
        "name": "check mark button",
        "keywords": [
          "yes",
          "verified",
          "approved",
          "done",
          "ok"
        ]
      },
      {
        "emoji": "✔️",
        "name": "check mark",
        "keywords": [
          "done",
          "yes"
        ]
      },
      {
        "emoji": "☑️",
        "name": "check box with check",
        "keywords": [
          "vote",
          "checked"
        ]
      },
      {
        "emoji": "🌐",
        "name": "globe with meridians",
        "keywords": [
          "internet",
          "world",
          "web"
        ]
      },
      {
        "emoji": "💤",
        "name": "zzz",
        "keywords": [
          "sleep",
          "tired",
          "bored"
        ]
      },
      {
        "emoji": "💬",
        "name": "speech balloon",
        "keywords": [
          "chat",
          "message",
          "text",
          "talk"
        ]
      },
      {
        "emoji": "💭",
        "name": "thought balloon",
        "keywords": [
          "thinking",
          "dream",
          "idea"
        ]
      },
      {
        "emoji": "🗯️",
        "name": "right anger bubble",
        "keywords": [
          "shout",
          "mad"
        ]
      },
      {
        "emoji": "🔴",
        "name": "red circle",
        "keywords": [
          "record",
          "red",
          "live"
        ]
      },
      {
        "emoji": "🟠",
        "name": "orange circle",
        "keywords": [
          "orange"
        ]
      },
      {
        "emoji": "🟡",
        "name": "yellow circle",
        "keywords": [
          "yellow"
        ]
      },
      {
        "emoji": "🟢",
        "name": "green circle",
        "keywords": [
          "online",
          "green",
          "active"
        ]
      },
      {
        "emoji": "🔵",
        "name": "blue circle",
        "keywords": [
          "blue"
        ]
      },
      {
        "emoji": "🟣",
        "name": "purple circle",
        "keywords": [
          "purple"
        ]
      },
      {
        "emoji": "⚫",
        "name": "black circle",
        "keywords": [
          "black",
          "dot"
        ]
      },
      {
        "emoji": "⚪",
        "name": "white circle",
        "keywords": [
          "white"
        ]
      },
      {
        "emoji": "🟤",
        "name": "brown circle",
        "keywords": [
          "brown"
        ]
      },
      {
        "emoji": "🔺",
        "name": "red triangle pointed up",
        "keywords": [
          "up",
          "triangle"
        ]
      },
      {
        "emoji": "🔻",
        "name": "red triangle pointed down",
        "keywords": [
          "down",
          "triangle"
        ]
      },
      {
        "emoji": "✨",
        "name": "sparkles",
        "keywords": [
          "magic",
          "shine",
          "star",
          "glow",
          "ai"
        ]
      }
    ]
  },
  {
    "id": "flags",
    "name": "Flags",
    "icon": "flag-outline",
    "emojis": [
      {
        "emoji": "🏁",
        "name": "chequered flag",
        "keywords": [
          "finish",
          "destination",
          "arrived",
          "done",
          "race"
        ]
      },
      {
        "emoji": "🚩",
        "name": "triangular flag",
        "keywords": [
          "flag",
          "landmark",
          "post",
          "red flag"
        ]
      },
      {
        "emoji": "🎌",
        "name": "crossed flags",
        "keywords": [
          "japan",
          "celebration"
        ]
      },
      {
        "emoji": "🏴",
        "name": "black flag",
        "keywords": [
          "pirate",
          "dark"
        ]
      },
      {
        "emoji": "🏳️",
        "name": "white flag",
        "keywords": [
          "surrender",
          "peace"
        ]
      },
      {
        "emoji": "🏳️‍🌈",
        "name": "rainbow flag",
        "keywords": [
          "pride",
          "lgbt",
          "rainbow"
        ]
      },
      {
        "emoji": "🏳️‍⚧️",
        "name": "transgender flag",
        "keywords": [
          "trans",
          "pride"
        ]
      },
      {
        "emoji": "🏴‍☠️",
        "name": "pirate flag",
        "keywords": [
          "skull",
          "pirate",
          "treasure"
        ]
      },
      {
        "emoji": "🇺🇸",
        "name": "United States",
        "keywords": [
          "usa",
          "america",
          "flag"
        ]
      },
      {
        "emoji": "🇬🇧",
        "name": "United Kingdom",
        "keywords": [
          "uk",
          "britain",
          "england"
        ]
      },
      {
        "emoji": "🇨🇦",
        "name": "Canada",
        "keywords": [
          "canada",
          "maple"
        ]
      },
      {
        "emoji": "🇦🇺",
        "name": "Australia",
        "keywords": [
          "australia",
          "aussie"
        ]
      },
      {
        "emoji": "🇮🇳",
        "name": "India",
        "keywords": [
          "india",
          "bharat"
        ]
      },
      {
        "emoji": "🇩🇪",
        "name": "Germany",
        "keywords": [
          "germany",
          "deutschland"
        ]
      },
      {
        "emoji": "🇫🇷",
        "name": "France",
        "keywords": [
          "france",
          "french"
        ]
      },
      {
        "emoji": "🇯🇵",
        "name": "Japan",
        "keywords": [
          "japan",
          "japanese"
        ]
      },
      {
        "emoji": "🇰🇷",
        "name": "South Korea",
        "keywords": [
          "korea",
          "kpop"
        ]
      },
      {
        "emoji": "🇮🇹",
        "name": "Italy",
        "keywords": [
          "italy",
          "italian"
        ]
      },
      {
        "emoji": "🇪🇸",
        "name": "Spain",
        "keywords": [
          "spain",
          "spanish"
        ]
      },
      {
        "emoji": "🇧🇷",
        "name": "Brazil",
        "keywords": [
          "brazil",
          "brasil"
        ]
      },
      {
        "emoji": "🇲🇽",
        "name": "Mexico",
        "keywords": [
          "mexico",
          "mexican"
        ]
      },
      {
        "emoji": "🇨🇳",
        "name": "China",
        "keywords": [
          "china",
          "chinese"
        ]
      },
      {
        "emoji": "🇷🇺",
        "name": "Russia",
        "keywords": [
          "russia",
          "russian"
        ]
      },
      {
        "emoji": "🇳🇱",
        "name": "Netherlands",
        "keywords": [
          "holland",
          "dutch"
        ]
      },
      {
        "emoji": "🇸🇪",
        "name": "Sweden",
        "keywords": [
          "sweden",
          "swedish"
        ]
      },
      {
        "emoji": "🇨🇭",
        "name": "Switzerland",
        "keywords": [
          "swiss",
          "alps"
        ]
      },
      {
        "emoji": "🇦🇪",
        "name": "United Arab Emirates",
        "keywords": [
          "uae",
          "dubai"
        ]
      },
      {
        "emoji": "🇸🇬",
        "name": "Singapore",
        "keywords": [
          "singapore"
        ]
      },
      {
        "emoji": "🇳🇿",
        "name": "New Zealand",
        "keywords": [
          "nz",
          "kiwi"
        ]
      },
      {
        "emoji": "🇿🇦",
        "name": "South Africa",
        "keywords": [
          "africa"
        ]
      }
    ]
  }
];
