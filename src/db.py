import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ["DATABASE_URL"]

@contextmanager
def conexao():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as con:
        yield con
