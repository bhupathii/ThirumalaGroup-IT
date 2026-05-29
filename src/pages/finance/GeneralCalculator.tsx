import React, { useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { Calculator, Printer, Calendar, RefreshCw } from 'lucide-react';

interface CalculatedScheduleItem {
  sno: number;
  dueDate: string;
  amount: number;
}

const GeneralCalculator: React.FC = () => {
  const [principal, setPrincipal] = useState('10000');
  const [interestRate, setInterestRate] = useState('2'); // 2% per month
  const [duration, setDuration] = useState('100'); // 100 days default
  const [durationType, setDurationType] = useState<'days' | 'weeks' | 'months'>('days');
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [results, setResults] = useState<{
    principal: number;
    interestAmount: number;
    totalRepayment: number;
    dueAmount: number;
    totalDuesCount: number;
    schedule: CalculatedScheduleItem[];
  } | null>(null);

  const calculateLoan = () => {
    const P = Number(principal);
    const R = Number(interestRate);
    const D = Number(duration);

    if (isNaN(P) || P <= 0 || isNaN(R) || R < 0 || isNaN(D) || D <= 0) {
      alert('Please fill out all fields with positive numbers.');
      return;
    }

    // Convert duration to days for standard local simple flat interest
    let durationInMonths = 0;
    if (durationType === 'days') {
      durationInMonths = D / 30;
    } else if (durationType === 'weeks') {
      durationInMonths = D / 4.33;
    } else {
      durationInMonths = D;
    }

    // Flat interest rate model (Rate R is per month)
    const interestAmount = P * (R / 100) * durationInMonths;
    const totalRepayment = P + interestAmount;

    // Calculate number of dues based on dueType and duration
    let totalDuesCount = 0;
    let daysStep = 1;

    if (dueType === 'Daily') {
      if (durationType === 'days') totalDuesCount = D;
      else if (durationType === 'weeks') totalDuesCount = D * 7;
      else totalDuesCount = D * 30;
      daysStep = 1;
    } else if (dueType === 'Weekly') {
      if (durationType === 'days') totalDuesCount = Math.ceil(D / 7);
      else if (durationType === 'weeks') totalDuesCount = D;
      else totalDuesCount = Math.ceil(D * 4.33);
      daysStep = 7;
    } else {
      if (durationType === 'days') totalDuesCount = Math.ceil(D / 30);
      else if (durationType === 'weeks') totalDuesCount = Math.ceil(D / 4.33);
      else totalDuesCount = D;
      daysStep = 30;
    }

    const dueAmount = totalRepayment / totalDuesCount;

    // Generate schedule
    const schedule: CalculatedScheduleItem[] = [];
    const start = new Date(startDate);

    for (let i = 1; i <= totalDuesCount; i++) {
      const nextDate = new Date(start);
      if (dueType === 'Daily') {
        nextDate.setDate(start.getDate() + (i - 1));
      } else if (dueType === 'Weekly') {
        nextDate.setDate(start.getDate() + (i - 1) * 7);
      } else {
        nextDate.setMonth(start.getMonth() + (i - 1));
      }

      schedule.push({
        sno: i,
        dueDate: nextDate.toISOString().split('T')[0],
        amount: parseFloat(dueAmount.toFixed(2))
      });
    }

    setResults({
      principal: P,
      interestAmount: parseFloat(interestAmount.toFixed(2)),
      totalRepayment: parseFloat(totalRepayment.toFixed(2)),
      dueAmount: parseFloat(dueAmount.toFixed(2)),
      totalDuesCount,
      schedule
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">General Calculator</h1>
          <p className="text-gray-500 text-sm mt-1">Simulate interest calculations and generate printable payment schedules</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        {/* Form panel */}
        <div className="space-y-6 print:hidden">
          <Card title="Loan Calculator Details" subtitle="Input criteria to calculate loan amortization schedule">
            <div className="space-y-4">
              <Input
                label="Principal Amount (₹)"
                type="number"
                value={principal}
                onChange={setPrincipal}
                placeholder="e.g. 50000"
              />

              <Input
                label="Flat Interest Rate (% per Month)"
                type="number"
                value={interestRate}
                onChange={setInterestRate}
                placeholder="e.g. 2"
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Loan Duration"
                  type="number"
                  value={duration}
                  onChange={setDuration}
                  placeholder="e.g. 100"
                />
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                    Unit
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                    style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                  Due Collection Type
                </label>
                <select
                  value={dueType}
                  onChange={(e) => setDueType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                  style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                >
                  <option value="Daily">Daily Dues</option>
                  <option value="Weekly">Weekly Dues</option>
                  <option value="Monthly">Monthly Dues</option>
                </select>
              </div>

              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={setStartDate}
              />

              <div className="flex gap-2 pt-2">
                <Button onClick={calculateLoan} variant="success" className="flex-1" icon={Calculator}>
                  Calculate Loan
                </Button>
                <Button
                  onClick={() => {
                    setPrincipal('10000');
                    setInterestRate('2');
                    setDuration('100');
                    setDurationType('days');
                    setDueType('Daily');
                    setResults(null);
                  }}
                  variant="secondary"
                  icon={RefreshCw}
                >
                  Reset
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Results / Print View Panel */}
        <div className="lg:col-span-2 space-y-6 print:col-span-3">
          {results ? (
            <div className="space-y-6">
              {/* Calculation Summary Card */}
              <Card
                title={
                  <div className="flex justify-between items-center w-full">
                    <span>Calculation Summary</span>
                    <Button onClick={handlePrint} variant="primary" size="sm" icon={Printer} className="print:hidden">
                      Print A4 Schedule
                    </Button>
                  </div>
                }
                subtitle="Calculated simple flat interest summary details"
                className="shadow border-green-200"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-xs font-semibold block">Principal</span>
                    <span className="text-lg font-bold text-gray-900">₹{results.principal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-xs font-semibold block">Interest Amount</span>
                    <span className="text-lg font-bold text-gray-900">₹{results.interestAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-xs font-semibold block">Total Repayment</span>
                    <span className="text-lg font-bold text-green-700">₹{results.totalRepayment.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100 col-span-2 md:col-span-1">
                    <span className="text-green-700 text-xs font-bold block">{dueType} Due Amount</span>
                    <span className="text-xl font-extrabold text-green-800">₹{results.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-xs font-semibold block">Total Instalments</span>
                    <span className="text-lg font-bold text-gray-900">{results.totalDuesCount}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-xs font-semibold block">Rate & Duration</span>
                    <span className="text-sm font-bold text-gray-900">{interestRate}% pm / {duration} {durationType}</span>
                  </div>
                </div>
              </Card>

              {/* A4 Printable Schedule Sheet */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200 printable-schedule print:border-none print:shadow-none print:p-0">
                {/* Print Header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-wide">श्री तिरुमला कॉटन मिल्स</h2>
                  <h3 className="text-xl font-bold text-gray-800 mt-1">THIRUMALA GROUP FINANCE</h3>
                  <p className="text-xs text-gray-500 mt-0.5">LOAN REPAYMENT SCHEDULE & INVOICE</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p className="font-bold text-gray-800">Loan Details:</p>
                    <table className="min-w-full text-xs mt-1">
                      <tbody>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2">Principal Amount:</td>
                          <td className="font-bold">₹{results.principal.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2">Flat Interest:</td>
                          <td className="font-bold">₹{results.interestAmount.toLocaleString('en-IN')} ({interestRate}% pm)</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2">Total Payable:</td>
                          <td className="font-extrabold text-green-700">₹{results.totalRepayment.toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">Instalment Plan:</p>
                    <table className="min-w-full text-xs mt-1">
                      <tbody>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2 text-right">Instalment Mode:</td>
                          <td className="font-bold text-right">{dueType}</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2 text-right">Instalment Amount:</td>
                          <td className="font-bold text-right text-lg text-gray-900">₹{results.dueAmount.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-gray-500 pr-2 text-right">Total Installments:</td>
                          <td className="font-bold text-right">{results.totalDuesCount}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dues Schedule Table */}
                <h4 className="font-bold text-gray-800 text-sm mb-2 border-b pb-1">Due Dates & Payment Schedule</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-1.5 text-center font-bold">S.No</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center font-bold">Due Date</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-right font-bold">Due Amount</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center font-bold">Received (Sign / Date)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.schedule.map((item) => (
                        <tr key={item.sno} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1 text-center font-bold">{item.sno}</td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                            ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center text-gray-400 font-normal italic">
                            _________________
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Print Signatures */}
                <div className="flex justify-between items-center mt-12 pt-6 border-t text-xs">
                  <div>
                    <p className="font-bold text-gray-700">Customer Signature</p>
                    <p className="text-[10px] text-gray-400 mt-8">Authorized Signatory</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-700">For Thirumala Group Finance</p>
                    <p className="text-[10px] text-gray-400 mt-8">Partner / Cashier Sign</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed rounded-lg py-16 px-4 bg-gray-50/50">
              <Calculator className="w-12 h-12 text-gray-400 stroke-1 mb-3" />
              <p className="text-gray-500 text-sm font-semibold">Amortization sheet will be displayed here</p>
              <p className="text-gray-400 text-xs mt-1">Please enter loan metrics on the left panel and click Calculate Loan</p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded print CSS for rendering beautiful A4 and hiding app layouts */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-schedule, .printable-schedule * {
            visibility: visible;
          }
          .printable-schedule {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          aside, nav, header, button, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GeneralCalculator;
