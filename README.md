# lm-explorer
interactive explorer for language models

## Docker build

```
$ docker build -t lm-explorer .
$ docker run -p 8000:8000 -v /$HOME/.pytorch_pretrained_bert:/root/.pytorch_pretrained_bert lm-explorer
```
