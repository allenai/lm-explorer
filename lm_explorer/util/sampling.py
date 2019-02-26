import torch

def random_sample(logits: torch.Tensor, temperature: float = 1.0) -> int:
    d = torch.distributions.Categorical(logits=logits / temperature)
    return d.sample().item()


#         # Sample from logits
#         d = torch.distributions.Categorical(logits=logits[0, -1])
#         next_id = d.sample().item()

#         if next_id == END_OF_TEXT:
#             break

#         token_ids.append(next_id)
#         inputs = torch.LongTensor([[next_id]])

#     # Decode
#     return tokenizer.decode(token_ids)
