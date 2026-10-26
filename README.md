# usage-donuts

A Claude Code mod that draws four usage donuts in the hint line under the chat input:

- **Context**: how full the context window is
- **Session**: the 5-hour rate-limit window
- **Weekly**: the 7-day window
- **Fable wk**: a separate Fable weekly window, when the account reports one

Each ring is green under 25%, yellow from 25%, orange from 50% and red above 75%. Hovering a donut shows its exact percentage and when it resets. In the terminal the same figures are added as text to the end of the hint line.

## Install

At the prompt of a terminal session:

```
/plugin install usage-donuts --marketplace MichaelFu1998-create/claude-usage-donuts
```

From a shell:

```bash
claude plugin install usage-donuts --marketplace MichaelFu1998-create/claude-usage-donuts
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `MichaelFu1998-create/claude-usage-donuts`, then Add plugin.

## Test

```bash
claude plugin test .
```
