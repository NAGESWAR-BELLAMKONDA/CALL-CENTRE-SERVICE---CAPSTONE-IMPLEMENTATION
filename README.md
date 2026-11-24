# Call-Centre Service Performance Analysis Using t-Test for Difference of Means

An interactive educational capstone prototype for comparing two independent call-centre service groups using Welch's two-sample t-test.

## Run locally
Open `index.html` in a modern browser. No build step or external dependency is required.

## Features
- Input two independent samples.
- Calculate sample means and variances.
- Welch t-statistic and Welch-Satterthwaite degrees of freedom.
- Two-tailed p-value and confidence interval for the difference.
- Decision against a selectable significance level.
- Mean comparison chart and calculation steps.

## Data note
The preloaded observations are synthetic demonstration data, not verified company records. Replace them with the actual project dataset before using numerical findings in an academic submission. Document the measurement unit, sampling method, observation period, and group definitions.

## Deployment
GitHub Actions workflow: `.github/workflows/deploy.yml`. It validates `index.html` and deploys the static site to GitHub Pages on pushes to `main` and manual dispatch.
