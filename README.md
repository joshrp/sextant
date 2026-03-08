# Sextant — Captain of Industry Planner

A production planning calculator for [Captain of Industry](https://www.captain-of-industry.com/). Build factory graphs, define production goals, and let a linear programming solver tell you exactly how many machines you need.

**[https://joshrp.github.io/Sextant/](https://joshrp.github.io/Sextant/)**

## Features

- Visual factory graph editor built on React Flow
- Linear programming solver (HiGHS.js) with multiple optimisation strategies (infrastructure cost, inputs, footprint, outputs)
- Full game data coverage — recipes, machines, products, mines, storages
- Multiple production zones and factories per plan
- Import/export factory designs (Base85 encoded)
- Recyclables breakdown for downstream scrap planning

## Bug Reports & Feature Requests

Please open an issue on the [GitHub issue tracker](https://github.com/joshrp/Sextant/issues).

## Development

```bash
npm install        # install dependencies
npm run dev        # dev server on :5173
npm run build      # production build
npm test           # unit + component tests
npm run cosmos     # component visual testing (React Cosmos)
npm run typecheck  # type check
npm run lint       # lint
```

Game data is generated from mod exports in `data/raw/`. Regenerate with `npm run formatData`.

## Contributing

Contributions are welcome via pull request. For larger changes, consider opening an issue first to discuss your approach.

## License

[GPL-3.0](LICENSE)
