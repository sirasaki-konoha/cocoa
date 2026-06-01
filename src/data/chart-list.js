import alternateChart from './alternate-chart.json';
import sampleChart from './sample-chart.json';

export const builtInCharts = [
  {
    id: 'cocoa-demo-beat',
    label: 'Basic Demo',
    description: '仕様確認用の標準譜面。7レーンと水色ノーツを一通り確認できます。',
    chart: sampleChart,
  },
  {
    id: 'cocoa-cross-pattern',
    label: 'Cross Pattern',
    description: '左右交互と同時押しを増やした短めの譜面です。',
    chart: alternateChart,
  },
];
