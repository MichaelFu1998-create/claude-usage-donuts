# usage-donuts

A Claude Code mod that shows four usage cards in the band just above the chat input, each 40px high:

- **Context**: how full the context window is
- **5-hour session**: the 5-hour rate-limit window
- **Weekly**: the 7-day window
- **Weekly Fable**: a separate Fable weekly window, when the account reports one

Each card has a usage donut, green under 25%, yellow from 25%, orange from 50% and red above 75%. The 5-hour session and Weekly cards also have a blue countdown donut showing the time left until the window resets: minutes for the 5-hour window, days for the weekly ones (hours on the last day), updated every minute. In the terminal the same figures show as one line of text.

Type `/usage-donuts` to hide the band, and again to show it.

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
