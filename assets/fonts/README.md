# Vespera Display (web subset)

Source: [lartpang/VesperaFont](https://github.com/lartpang/VesperaFont) release v0.0.1,
`woff2/VesperaDisplay-{Regular,Italic,Bold}.woff2`, licensed under the GUST Font License
(see `GUST-FONT-LICENSE.txt`).

Each file is subset to Latin (Basic, Latin-1, Latin Extended-A) plus common punctuation and
arrows, keeping kerning, ligatures and figure styles. Chinese text falls back to system fonts.

Rebuild after a new release (needs `pip install fonttools brotli`):

```bash
U="U+0020-007E,U+00A0-017F,U+0192,U+02C6,U+02DA,U+02DC,U+2010-2027,U+2030-203A,U+2044,U+20AC,U+2122,U+2190-2199,U+2212"
for s in Regular Italic Bold; do
  pyftsubset "woff2/VesperaDisplay-$s.woff2" --unicodes="$U" \
    --layout-features='kern,liga,clig,calt,onum,lnum,tnum,pnum,case,frac,sups,subs' \
    --flavor=woff2 --no-hinting --desubroutinize \
    --output-file="VesperaDisplay-$s.subset.woff2"
done
```
