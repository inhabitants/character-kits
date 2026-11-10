# Character kits

Original characters you can talk to and draw, each one in a single folder.

A card on a chat hub gives you a voice and one picture. A LoRA on Civitai gives you a face and no one behind it. A kit is both, tied together: the card names the LoRA, and every image in the folder was made with it.

No stock scenes. Every image comes from who the character is: her trade, her habits, her city, the scene her first message opens on.

## Characters

| | Character | Who she is | LoRA |
|---|---|---|---|
| <img src="characters/nora-ferraz/card.png" width="96"> | [Nora Ferraz](characters/nora-ferraz/) | Freelance journalist in Rio who shoots on film and counts every frame | [Krea 2](https://civitai.com/models/3028183) |

## What a kit holds

```
characters/<name>/
  card.png        character card, V3 and V2 embedded in the image
  card.json       the same card as JSON
  sheet.jpg       reference sheet
  reference/      front, profile, full body and back, in the character's own look
  poses/          scenes from the character's life, made with the LoRA alone
  expressions/    28 expression sprites, SillyTavern names, set in the card's opening scene
  lora.json       model page, trigger, weight, tested settings
  README.md
```

## Use it

- **Chat:** import `card.png` into SillyTavern, RisuAI, Chub or any app that reads Tavern cards.
- **Sprites:** copy `expressions/` into the character's folder in SillyTavern and turn on Character Expressions.
- **Images:** download the LoRA from the link in `lora.json` and prompt with the trigger.
- **Agents:** point yours at this README and at the character's `lora.json`.

## Build a card

`tools/card.mjs` has no dependencies. It takes `card.json` and a portrait and writes the PNG with both card versions inside, keeping whatever metadata the portrait already had.

```bash
node tools/card.mjs build characters/nora-ferraz --image characters/nora-ferraz/poses/awning-in-lapa.png
```

```bash
node tools/card.mjs read characters/nora-ferraz/card.png
```

## License

Cards, images and sheets: CC BY 4.0. Credit the character by name and link back here. The code in `tools/` is MIT. Each LoRA follows the license on its own model page.

Published as is, with no support promised. Fork it and make it yours.

Made at [Sapiens Sintéticos](https://www.sapiensinteticos.com/).
