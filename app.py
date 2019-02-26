"""
"""

from typing import List, Callable
import argparse
import json
import logging
import os
from string import Template
import sys

import torch
from flask import Flask, request, Response, jsonify, send_file, send_from_directory
from flask_cors import CORS
from gevent.pywsgi import WSGIServer

from lm_explorer.lm.gpt2 import GPT2LanguageModel

logger = logging.getLogger(__name__)  # pylint: disable=invalid-name

class ServerError(Exception):
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        error_dict = dict(self.payload or ())
        error_dict['message'] = self.message
        return error_dict


def make_app() -> Flask:
    model = GPT2LanguageModel()

    app = Flask(__name__)  # pylint: disable=invalid-name

    @app.errorhandler(ServerError)
    def handle_invalid_usage(error: ServerError) -> Response:  # pylint: disable=unused-variable
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @app.route('/')
    def index() -> Response: # pylint: disable=unused-variable
        return send_file('app.html')

    @app.route('/predict', methods=['POST', 'OPTIONS'])
    def predict() -> Response:  # pylint: disable=unused-variable
        if request.method == "OPTIONS":
            return Response(response="", status=200)

        data = request.get_json()

        previous_str = data["previous"]
        next_str = data.get("next")
        topk = data.get("topk", 10)

        logits = model.predict(previous_str, next_str)
        probabilities = torch.nn.functional.softmax(logits)

        best_logits, best_indices = logits.topk(topk)
        best_words = [model[idx.item()] for idx in best_indices]
        best_probabilities = probabilities[best_indices].tolist()

        return jsonify({
            "logits": best_logits.tolist(),
            "probabilities": best_probabilities,
            "words": best_words,
            "output": previous_str + (next_str or "")
        })


    return app


def main(args):
    # Executing this file with no extra options runs the simple service with the bidaf test fixture
    # and the machine-comprehension predictor. There's no good reason you'd want
    # to do this, except possibly to test changes to the stock HTML).

    parser = argparse.ArgumentParser(description='Serve up a simple model')

    parser.add_argument('--port', type=int, default=8000, help='port to serve the demo on')

    args = parser.parse_args(args)

    app = make_app()
    CORS(app)

    http_server = WSGIServer(('0.0.0.0', args.port), app)
    print(f"Model loaded, serving demo on port {args.port}")
    http_server.serve_forever()

#
# HTML and Templates for the default bare-bones app are below
#

_HTML = """


"""

if __name__ == "__main__":
    main(sys.argv[1:])
