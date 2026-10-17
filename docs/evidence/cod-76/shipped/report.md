# Add Field parity (SAD-86)

Formula state expression: `IF(1 > 0, "big", "small")`

The **Field type row is masked** in both images (COD-76 replaced the native `<select>` with the
plugin's own picker, so that row differs by design). Every other part of the card is compared.

| Combo | State | Plugin | Prototype | Pixel diff |
|---|---|---|---|---|
| dark-owner | text | 384×369 | 384×369 | 0.14 % |
| dark-owner | select | 384×449 | 384×449 | 0.11 % |
| dark-owner | number | 384×369 | 384×369 | 0.14 % |
| dark-owner | formula | 384×437 | 384×437 | 0.12 % |
| dark-owner | link | 384×397 | 384×397 | 0.13 % |
| dark-mobile | text | 358×368 | 358×368 | 0.17 % |
| dark-mobile | select | 358×448 | 358×448 | 0.12 % |
| dark-mobile | number | 358×368 | 358×368 | 0.17 % |
| dark-mobile | formula | 358×436 | 358×436 | 0.13 % |
| dark-mobile | link | 358×398 | 358×398 | 0.15 % |
| light-owner | text | 384×369 | 384×369 | 0.94 % |
| light-owner | select | 384×449 | 384×449 | 0.77 % |
| light-owner | number | 384×369 | 384×369 | 0.94 % |
| light-owner | formula | 384×437 | 384×437 | 0.67 % |
| light-owner | link | 384×397 | 384×397 | 0.46 % |
| light-mobile | text | 358×368 | 358×368 | 0.70 % |
| light-mobile | select | 358×448 | 358×448 | 0.56 % |
| light-mobile | number | 358×368 | 358×368 | 0.69 % |
| light-mobile | formula | 358×436 | 358×436 | 0.45 % |
| light-mobile | link | 358×398 | 358×398 | 0.78 % |
