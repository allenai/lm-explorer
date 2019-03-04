"""
"""

from typing import List, Callable, NamedTuple
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
from lm_explorer.util.sampling import random_sample

logging.basicConfig(level=logging.INFO)


class BeamElement(NamedTuple):
    score: float
    prev_str: str
    next_str: str

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

    @app.route('/static/<path:path>')
    def static_proxy(path: str) -> Response: # pylint: disable=unused-variable
        return send_from_directory(os.path.join(build_dir, 'static'), path)

    @app.route('/predict', methods=['POST', 'OPTIONS'])
    def predict() -> Response:  # pylint: disable=unused-variable
        if request.method == "OPTIONS":
            return Response(response="", status=200)

        data = request.get_json()

        previous_str = data["previous"]
        next_str = data.get("next")
        topk = data.get("topk", 10)

        # Log the query
        app.logger.info(f"<{previous_str}> <{next_str}>")

        logits = model.predict(previous_str, next_str)
        probabilities = torch.nn.functional.softmax(logits)

        best_logits, best_indices = logits.topk(topk)
        best_words = [model[idx.item()] for idx in best_indices]
        best_probabilities = probabilities[best_indices].tolist()

        # random sample
        random_id = random_sample(logits)
        random_word = model[random_id]
        random_word_logit = logits[random_id].item()
        random_word_probability = probabilities[random_id].item()

        return jsonify({
            "logits": best_logits.tolist(),
            "probabilities": best_probabilities,
            "words": best_words,
            "output": previous_str + (next_str or "")
        })

    @app.route('/random', methods=['POST', 'OPTIONS'])
    def random() -> Response:  # pylint: disable=unused-variable
        if request.method == "OPTIONS":
            return Response(response="", status=200)

        data = request.get_json()

        previous_str = data["previous"]
        next_str = data.get("next", None)
        topk = data.get("topk", 10)
        num_steps = data.get('numsteps', 1)
        temperature = data.get("temperature", 1.0)

        logits = model.predict(previous_str, next_str)
        probabilities = torch.nn.functional.softmax(logits / temperature)

        samples = torch.multinomial(probabilities, num_samples=topk, replacement=False)
        outputs = [(f"{previous_str}{next_str or ''}", model[idx.item()]) for idx in samples]



        for _ in range(num_steps - 1):
            new_outputs = []
            for p, n in outputs:
                logits = model.predict(p, n)
                probabilities = torch.nn.functional.softmax(logits / temperature)
                random_id = random_sample(logits / temperature)
                random_word = model[random_id]
                random_word_logit = logits[random_id].item()
                random_word_probability = probabilities[random_id].item()

                new_outputs.append((f"{p}{n}", random_word))

            outputs = new_outputs

        return jsonify({
            "previous": previous_str,
            "words": [f"{p}{n}" for p, n in outputs],
            "logits": [0 for _ in outputs],
            "probabilities": [0 for _ in outputs]
        })




    @app.route('/beam', methods=['POST', 'OPTIONS'])
    def beam() -> Response:  # pylint: disable=unused-variable
        if request.method == "OPTIONS":
            return Response(response="", status=200)

        data = request.get_json()

        previous_str = data["previous"]
        next_str = data.get("next", "")
        topk = data.get("topk", 10)
        num_steps = data['numsteps']

        def candidates(s1: str = "", s2: str = None, score: float = 0.0) -> List[BeamElement]:
            logits = model.predict(previous_str + s1, s2)
            log_probabilities = torch.nn.functional.log_softmax(logits) + score

            best_log_probabilities, best_indices = log_probabilities.topk(topk)

            new_str = s1 if s2 is None else s1 + s2

            beam = [BeamElement(lp.item() + score, new_str, model[idx.item()])
                    for lp, idx in zip(best_log_probabilities, best_indices)]

            return beam

        # Initial step
        beam = candidates(next_str)

        for i in range(num_steps - 1):
            new_beam: List[BeamElement] = []

            for element in beam:
                new_beam.extend(candidates(element.prev_str, element.next_str, element.score))

            new_beam.sort(key=lambda elt: elt.score, reverse=True)

            beam = new_beam[:topk]

        return jsonify({
            "previous": previous_str,
            "words": [elt.prev_str + elt.next_str for elt in beam],
            "logits": [elt.score for elt in beam],
            "probabilities": [elt.score for elt in beam]
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

    http_server = WSGIServer(('0.0.0.0', args.port), app, log=sys.stdout)
    print(f"Model loaded, serving demo on port {args.port}")
    http_server.serve_forever()

#
# HTML and Templates for the default bare-bones app are below
#

_HTML = """


"""

if __name__ == "__main__":
    main(sys.argv[1:])
