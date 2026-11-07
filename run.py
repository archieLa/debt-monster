import argparse
from debtmonster.web import create_app

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Debt Monster local household tracker')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5050)
    parser.add_argument('--data-dir')
    args = parser.parse_args()
    create_app(args.data_dir).run(host=args.host, port=args.port, threaded=True, debug=False)
