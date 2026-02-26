// ─────────────────────────────────────────────────────────────────────────────
// Domain card component tests
//
// Covers:
//   - MetricCard: renders value/unit/label; trend + sparkline in
//     operator/expert; expert-only metadata; status colour classes; onExplain
//   - SensorCard: renders value/status/name/location; trend hidden in
//     executive; expert firmware/sampling; offline shows dash; onExplain;
//     battery indicator
//   - FlightCard (Executive / Operator / Expert): price/duration/airline;
//     times/stops/carbon in operator; fareClass/confidence in expert;
//     selected state; onSelect; onExplain
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { MetricCard, type MetricData } from '../components/domain/cloudops/MetricCard';
import { SensorCard, type SensorReading } from '../components/domain/iot/SensorCard';
import {
  FlightCardExecutive,
  FlightCardOperator,
  FlightCardExpert,
  type FlightOption,
} from '../components/domain/travel/FlightCard';

// ─────────────────────────────────────────────────────────────────────────────
// MetricCard
// ─────────────────────────────────────────────────────────────────────────────

const METRIC: MetricData = {
  id: 'm1',
  label: 'CPU Usage',
  value: 72,
  unit: '%',
  trend: 'up',
  status: 'warning',
  sparkline: [40, 55, 60, 72, 68, 75, 72, 72],
  sampledAt: new Date(Date.now() - 5_000).toISOString(),
  percentileRank: 87,
};

describe('MetricCard', () => {
  it('renders the metric label', () => {
    render(<MetricCard metric={METRIC} />);
    expect(screen.getByText('CPU Usage')).toBeDefined();
  });

  it('renders the metric value', () => {
    render(<MetricCard metric={METRIC} />);
    expect(screen.getByText('72')).toBeDefined();
  });

  it('renders the unit', () => {
    render(<MetricCard metric={METRIC} />);
    expect(screen.getByText('%')).toBeDefined();
  });

  it('renders trend in operator density', () => {
    render(<MetricCard metric={METRIC} density="operator" />);
    expect(screen.getByText(/up/i)).toBeDefined();
  });

  it('hides trend in executive density', () => {
    render(<MetricCard metric={METRIC} density="executive" />);
    expect(screen.queryByText(/↑/)).toBeNull();
  });

  it('renders sparkline SVG in operator density', () => {
    const { container } = render(<MetricCard metric={METRIC} density="operator" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('hides sparkline in executive density', () => {
    const { container } = render(<MetricCard metric={METRIC} density="executive" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders expert metadata (sampledAt + percentile) in expert density', () => {
    render(<MetricCard metric={METRIC} density="expert" />);
    expect(screen.getByText(/p87 baseline/i)).toBeDefined();
  });

  it('hides expert metadata in operator density', () => {
    render(<MetricCard metric={METRIC} density="operator" />);
    expect(screen.queryByText(/p87 baseline/)).toBeNull();
  });

  it('calls onExplain with the metric id when Why? is clicked', () => {
    const onExplain = vi.fn();
    render(<MetricCard metric={METRIC} onExplain={onExplain} />);
    fireEvent.click(screen.getByRole('button', { name: /Why/i }));
    expect(onExplain).toHaveBeenCalledWith('m1');
  });

  it('does not render Why? button when onExplain is not provided', () => {
    render(<MetricCard metric={METRIC} />);
    expect(screen.queryByRole('button', { name: /Why/i })).toBeNull();
  });

  it.each(['normal', 'warning', 'critical'] as const)(
    'renders without crashing for status=%s',
    (status) => {
      render(<MetricCard metric={{ ...METRIC, status }} density="operator" />);
      expect(screen.getByText('CPU Usage')).toBeDefined();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SensorCard
// ─────────────────────────────────────────────────────────────────────────────

const SENSOR: SensorReading = {
  id: 's1',
  name: 'Boiler',
  location: 'Plant A',
  type: 'temperature',
  value: 98.4,
  unit: '°C',
  status: 'warning',
  threshold: { warn: 80, critical: 120 },
  trend: 'rising',
  lastSeen: new Date(Date.now() - 30_000).toISOString(),
  battery: 65,
  firmwareVersion: '2.3.1',
  samplingRateHz: 10,
  rawPayload: { raw: 98.4, scale: 1 },
};

describe('SensorCard', () => {
  it('renders sensor name', () => {
    render(<SensorCard sensor={SENSOR} />);
    expect(screen.getByText(/Boiler/i)).toBeDefined();
  });

  it('renders sensor value', () => {
    render(<SensorCard sensor={SENSOR} />);
    expect(screen.getByText('98.4')).toBeDefined();
  });

  it('renders the unit', () => {
    render(<SensorCard sensor={SENSOR} />);
    expect(screen.getByText('°C')).toBeDefined();
  });

  it('renders trend arrow in operator density', () => {
    render(<SensorCard sensor={SENSOR} density="operator" />);
    expect(screen.getByText('↑')).toBeDefined();
  });

  it('hides trend arrow in executive density', () => {
    render(<SensorCard sensor={SENSOR} density="executive" />);
    expect(screen.queryByText('↑')).toBeNull();
  });

  it('renders location in operator density', () => {
    render(<SensorCard sensor={SENSOR} density="operator" />);
    expect(screen.getByText(/Plant A/i)).toBeDefined();
  });

  it('hides location in executive density', () => {
    render(<SensorCard sensor={SENSOR} density="executive" />);
    expect(screen.queryByText(/Plant A/i)).toBeNull();
  });

  it('renders battery level in operator density', () => {
    render(<SensorCard sensor={SENSOR} density="operator" />);
    expect(screen.getByText(/65%/)).toBeDefined();
  });

  it('shows "—" for offline sensor', () => {
    render(<SensorCard sensor={{ ...SENSOR, status: 'offline' }} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows firmware version in expert density', () => {
    render(<SensorCard sensor={SENSOR} density="expert" />);
    expect(screen.getByText(/fw 2\.3\.1/i)).toBeDefined();
  });

  it('shows sampling rate in expert density', () => {
    render(<SensorCard sensor={SENSOR} density="expert" />);
    expect(screen.getByText(/10 Hz/i)).toBeDefined();
  });

  it('shows raw payload toggle in expert density', () => {
    render(<SensorCard sensor={SENSOR} density="expert" />);
    expect(screen.getByText('raw payload')).toBeDefined();
  });

  it('hides expert details in operator density', () => {
    render(<SensorCard sensor={SENSOR} density="operator" />);
    expect(screen.queryByText(/fw 2\.3\.1/)).toBeNull();
  });

  it('calls onExplain with sensor id when Why? is clicked', () => {
    const onExplain = vi.fn();
    render(<SensorCard sensor={SENSOR} onExplain={onExplain} />);
    fireEvent.click(screen.getByRole('button', { name: /Why/i }));
    expect(onExplain).toHaveBeenCalledWith('s1');
  });

  it.each(['ok', 'warning', 'critical', 'offline'] as const)(
    'renders without crashing for status=%s',
    (status) => {
      render(<SensorCard sensor={{ ...SENSOR, status }} />);
      expect(screen.getByText(/Boiler/i)).toBeDefined();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FlightCard variants
// ─────────────────────────────────────────────────────────────────────────────

const FLIGHT: FlightOption = {
  id: 'f1',
  airline: 'Delta',
  flightNumber: 'DL404',
  price: 349,
  currency: '$',
  duration: '5h 10m',
  departTime: '08:00',
  arriveTime: '13:10',
  stops: 0,
  carbon: 143,
  fareClass: 'Economy',
  confidence: 0.92,
  note: '15% below route average',
};

describe('FlightCardExecutive', () => {
  it('renders the flight price', () => {
    render(<FlightCardExecutive flight={FLIGHT} />);
    expect(screen.getByText('$349')).toBeDefined();
  });

  it('renders the duration', () => {
    render(<FlightCardExecutive flight={FLIGHT} />);
    expect(screen.getByText('5h 10m')).toBeDefined();
  });

  it('renders the airline name', () => {
    render(<FlightCardExecutive flight={FLIGHT} />);
    expect(screen.getByText('Delta')).toBeDefined();
  });

  it('calls onSelect with flight id when clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(<FlightCardExecutive flight={FLIGHT} onSelect={onSelect} />);
    fireEvent.click(container.firstChild as Element);
    expect(onSelect).toHaveBeenCalledWith('f1');
  });

  it('calls onExplain when Why? button is clicked', () => {
    const onExplain = vi.fn();
    render(<FlightCardExecutive flight={FLIGHT} onExplain={onExplain} />);
    fireEvent.click(screen.getByRole('button', { name: /Why/i }));
    expect(onExplain).toHaveBeenCalledWith('f1');
  });

  it('applies selected styling when selected=true', () => {
    const { container } = render(<FlightCardExecutive flight={FLIGHT} selected />);
    const card = container.firstChild as HTMLElement;
    // Selected cards have indigo border colour
    expect(card.style.borderColor).toBe('rgb(79, 70, 229)');
  });
});

describe('FlightCardOperator', () => {
  it('renders depart and arrive times', () => {
    render(<FlightCardOperator flight={FLIGHT} />);
    expect(screen.getByText(/08:00/)).toBeDefined();
    expect(screen.getByText(/13:10/)).toBeDefined();
  });

  it('shows "Nonstop" for 0 stops', () => {
    render(<FlightCardOperator flight={FLIGHT} />);
    expect(screen.getByText('Nonstop')).toBeDefined();
  });

  it('shows stop count for multi-stop flights', () => {
    render(<FlightCardOperator flight={{ ...FLIGHT, stops: 2 }} />);
    expect(screen.getByText('2 stops')).toBeDefined();
  });

  it('shows carbon emission when provided', () => {
    render(<FlightCardOperator flight={FLIGHT} />);
    expect(screen.getByText(/143 kg CO₂/)).toBeDefined();
  });

  it('shows the note when provided', () => {
    render(<FlightCardOperator flight={FLIGHT} />);
    expect(screen.getByText('15% below route average')).toBeDefined();
  });

  it('calls onExplain from Why? button', () => {
    const onExplain = vi.fn();
    render(<FlightCardOperator flight={FLIGHT} onExplain={onExplain} />);
    fireEvent.click(screen.getByRole('button', { name: /Why/i }));
    expect(onExplain).toHaveBeenCalledWith('f1');
  });
});

describe('FlightCardExpert', () => {
  it('renders flight number in expert section', () => {
    render(<FlightCardExpert flight={FLIGHT} />);
    expect(screen.getByText(/Flight: DL404/)).toBeDefined();
  });

  it('renders fare class', () => {
    render(<FlightCardExpert flight={FLIGHT} />);
    expect(screen.getByText(/Fare class: Economy/)).toBeDefined();
  });

  it('renders agent confidence as percentage', () => {
    render(<FlightCardExpert flight={FLIGHT} />);
    expect(screen.getByText(/Agent confidence: 92%/)).toBeDefined();
  });

  it('also shows operator-level content (inherits FlightCardOperator)', () => {
    render(<FlightCardExpert flight={FLIGHT} />);
    expect(screen.getByText('Nonstop')).toBeDefined();
    expect(screen.getByText(/08:00/)).toBeDefined();
  });

  it('calls onSelect when the card is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(<FlightCardExpert flight={FLIGHT} onSelect={onSelect} />);
    fireEvent.click(container.firstChild as Element);
    expect(onSelect).toHaveBeenCalledWith('f1');
  });
});
