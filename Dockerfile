FROM python:3.6.8

WORKDIR /local
COPY . /local

RUN pip install -r requirements.txt

CMD ["python", "app.py", "--port", "8000"]
