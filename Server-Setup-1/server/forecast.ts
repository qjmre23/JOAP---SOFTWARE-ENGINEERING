interface DataPoint {
  date: string;
  value: number;
}

interface ForecastResult {
  historical: DataPoint[];
  forecast: DataPoint[];
  model: {
    type: string;
    arCoefficients: number[];
    maWindow: number;
    trend: number;
    intercept: number;
  };
}

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function computeAutoregression(residuals: number[], order: number): number[] {
  if (residuals.length < order + 1) return new Array(order).fill(0);
  const coeffs: number[] = [];
  for (let lag = 1; lag <= order; lag++) {
    let num = 0, den = 0;
    for (let i = lag; i < residuals.length; i++) {
      num += residuals[i] * residuals[i - lag];
      den += residuals[i - lag] * residuals[i - lag];
    }
    coeffs.push(den !== 0 ? num / den : 0);
  }
  return coeffs;
}

function fillMissingDates(dataPoints: DataPoint[]): DataPoint[] {
  if (dataPoints.length < 2) return dataPoints;
  const filled: DataPoint[] = [];
  const start = new Date(dataPoints[0].date);
  const end = new Date(dataPoints[dataPoints.length - 1].date);
  const lookup = new Map(dataPoints.map(p => [p.date, p.value]));
  const d = new Date(start);
  while (d <= end) {
    const key = d.toISOString().split("T")[0];
    filled.push({ date: key, value: lookup.get(key) || 0 });
    d.setDate(d.getDate() + 1);
  }
  return filled;
}

export function arimaForecast(
  dataPoints: DataPoint[],
  forecastDays: number = 30,
  arOrder: number = 3,
  maWindow: number = 7
): ForecastResult {
  dataPoints = fillMissingDates(dataPoints);

  if (dataPoints.length < 7) {
    const lastDate = dataPoints.length > 0
      ? new Date(dataPoints[dataPoints.length - 1].date)
      : new Date();
    const avg = dataPoints.length > 0
      ? dataPoints.reduce((s, p) => s + p.value, 0) / dataPoints.length
      : 0;
    const forecast: DataPoint[] = [];
    for (let i = 1; i <= forecastDays; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      forecast.push({ date: d.toISOString().split("T")[0], value: Math.max(0, Math.round(avg)) });
    }
    return {
      historical: dataPoints,
      forecast,
      model: { type: "ARIMA-like (insufficient data, using mean)", arCoefficients: [], maWindow, trend: 0, intercept: avg },
    };
  }

  const values = dataPoints.map(p => p.value);

  const { slope, intercept } = linearRegression(values);

  const trendComponent = values.map((_, i) => intercept + slope * i);

  const residuals = values.map((v, i) => v - trendComponent[i]);

  const arCoeffs = computeAutoregression(residuals, Math.min(arOrder, Math.floor(residuals.length / 3)));

  const smoothed = movingAverage(values, maWindow);

  const lastDate = new Date(dataPoints[dataPoints.length - 1].date);
  const n = values.length;
  const forecast: DataPoint[] = [];

  const recentResiduals = residuals.slice(-arOrder);

  for (let i = 1; i <= forecastDays; i++) {
    const trendVal = intercept + slope * (n + i - 1);

    let arVal = 0;
    for (let j = 0; j < arCoeffs.length; j++) {
      const idx = recentResiduals.length - 1 - j;
      if (idx >= 0) {
        arVal += arCoeffs[j] * recentResiduals[idx];
      }
    }

    const maSmooth = smoothed[smoothed.length - 1] || 0;
    const trendWeight = 0.4;
    const arWeight = 0.3;
    const maWeight = 0.3;

    let predicted = trendWeight * trendVal + arWeight * (trendVal + arVal) + maWeight * maSmooth;
    predicted = Math.max(0, Math.round(predicted));

    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    forecast.push({ date: d.toISOString().split("T")[0], value: predicted });

    recentResiduals.push(predicted - trendVal);
    if (recentResiduals.length > arOrder) recentResiduals.shift();
  }

  return {
    historical: dataPoints,
    forecast,
    model: {
      type: "ARIMA-like (AR + Trend + MA)",
      arCoefficients: arCoeffs,
      maWindow,
      trend: slope,
      intercept,
    },
  };
}
