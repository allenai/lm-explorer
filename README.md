# lm-explorer
interactive explorer for language models

## Local Execution

```bash
# This creates a local directory where the model can be cached so you don't
# have to download it everytime you execute 'docker run'.
$ mkdir -p /$HOME/.pytorch_pretrained_bert
$ docker build -t lm-explorer:latest .
$ docker run -p 8000:8000 \
    -v /$HOME/.pytorch_pretrained_bert:/root/.pytorch_pretrained_bert \
    -v $(pwd):/local \
    lm-explorer:latest \
    python app.py --port 8000 --dev
```
