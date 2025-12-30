import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

const INITIAL_WEEKLY_DATA = {
  weekNumber: 1,
  days: {
    monday: { 
      endorsementsToBeIssued: '0/0',
      endorsementsReadyToBeIssued: '0/0',
      weeksAheadSRAExp: '0/0',
      endorsementsReceived: '0/0', 
      applicationsReceived: '0/0', 
      sendingSRA: '', 
      sendingEndorsements: '', 
      corrections: 0 
    },
    tuesday: { 
      endorsementsToBeIssued: '0/0',
      endorsementsReadyToBeIssued: '0/0',
      weeksAheadSRAExp: '0/0',
      endorsementsReceived: '0/0', 
      applicationsReceived: '0/0', 
      sendingSRA: '', 
      sendingEndorsements: '', 
      corrections: 0 
    },
    wednesday: { 
      endorsementsToBeIssued: '0/0',
      endorsementsReadyToBeIssued: '0/0',
      weeksAheadSRAExp: '0/0',
      endorsementsReceived: '0/0', 
      applicationsReceived: '0/0', 
      sendingSRA: '', 
      sendingEndorsements: '', 
      corrections: 0 
    },
    thursday: { 
      endorsementsToBeIssued: '0/0',
      endorsementsReadyToBeIssued: '0/0',
      weeksAheadSRAExp: '0/0',
      endorsementsReceived: '0/0', 
      applicationsReceived: '0/0', 
      sendingSRA: '', 
      sendingEndorsements: '', 
      corrections: 0 
    },
    friday: { 
      endorsementsToBeIssued: '0/0',
      endorsementsReadyToBeIssued: '0/0',
      weeksAheadSRAExp: '0/0',
      endorsementsReceived: '0/0', 
      applicationsReceived: '0/0', 
      sendingSRA: '', 
      sendingEndorsements: '', 
      corrections: 0 
    },
  },
  correctionNotes: [] // Array of { id, text, completed }
};

// Load saved data from localStorage
const loadSavedData = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Get current week number
const getCurrentWeek = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
};

// Historical data - update these as needed
const MONTHLY_DATA = {
  '2024-10': 1013, '2024-11': 1139, '2024-12': 1345,
  '2025-01': 745, '2025-02': 875, '2025-03': 1061,
  '2025-04': 1084, '2025-05': 1315, '2025-06': 1029,
  '2025-07': 2178, '2025-08': 1398, '2025-09': 1090,
};

const WEEKLY_HISTORY = { 44: 488, 45: 489, 46: 397, 47: 426 };

export default function App() {
  const [weeklyData, setWeeklyData] = useState(() => 
    loadSavedData('seafarers_weeklyData', { ...INITIAL_WEEKLY_DATA, weekNumber: getCurrentWeek() })
  );
  const [csvData, setCsvData] = useState(null);
  const [outstandingEnd, setOutstandingEnd] = useState(() => 
    loadSavedData('seafarers_outstandingEnd', null)
  );
  const [nextSRA, setNextSRA] = useState(() => 
    loadSavedData('seafarers_nextSRA', null)
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [monthlyData, setMonthlyData] = useState(MONTHLY_DATA);
  const [weeklyHistory, setWeeklyHistory] = useState(WEEKLY_HISTORY);
  const [newCorrectionNote, setNewCorrectionNote] = useState('');
  const [lastSaved, setLastSaved] = useState(null);

  // Auto-save weeklyData to localStorage
  useEffect(() => {
    localStorage.setItem('seafarers_weeklyData', JSON.stringify(weeklyData));
    setLastSaved(new Date());
  }, [weeklyData]);

  // Auto-save outstandingEnd to localStorage
  useEffect(() => {
    if (outstandingEnd) {
      localStorage.setItem('seafarers_outstandingEnd', JSON.stringify(outstandingEnd));
    }
  }, [outstandingEnd]);

  // Auto-save nextSRA to localStorage
  useEffect(() => {
    if (nextSRA) {
      localStorage.setItem('seafarers_nextSRA', JSON.stringify(nextSRA));
    }
  }, [nextSRA]);

  // Function to reset all data for new week
  const resetForNewWeek = () => {
    if (window.confirm('⚠️ Tens a certeza que queres limpar todos os dados e começar uma nova semana?')) {
      const newData = { ...INITIAL_WEEKLY_DATA, weekNumber: getCurrentWeek() };
      setWeeklyData(newData);
      setOutstandingEnd(null);
      setNextSRA(null);
      setCsvData(null);
      localStorage.removeItem('seafarers_outstandingEnd');
      localStorage.removeItem('seafarers_nextSRA');
    }
  };

  const calculateTotals = useCallback(() => {
    let perSeafarer = 0, perEndorsement = 0, appSeafarer = 0, appCert = 0;
    Object.values(weeklyData.days).forEach(day => {
      const [es, ee] = day.endorsementsReceived.split('/').map(n => parseInt(n) || 0);
      const [as, ac] = day.applicationsReceived.split('/').map(n => parseInt(n) || 0);
      perSeafarer += es; perEndorsement += ee; appSeafarer += as; appCert += ac;
    });
    return { perSeafarer, perEndorsement, appSeafarer, appCert };
  }, [weeklyData]);

  const totals = calculateTotals();

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((header, i) => { obj[header] = values[i]?.replace(/"/g, '').trim() || ''; });
        return obj;
      });
      setCsvData(data);
      calculateOutstandingEnd(data);
      findNextSRA(data);
    };
    reader.readAsText(file);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // Extract week number from row 1, column G (index 6)
      const weekNum = json[1]?.[6] || getCurrentWeek();
      
      // Extract data from the Excel - matching exact structure
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const newDays = {};
      
      dayNames.forEach((day, i) => {
        newDays[day] = {
          endorsementsToBeIssued: json[4]?.[i + 1]?.toString() || '0/0',
          endorsementsReadyToBeIssued: json[5]?.[i + 1]?.toString() || '0/0',
          weeksAheadSRAExp: json[6]?.[i + 1]?.toString() || '0/0',
          endorsementsReceived: json[7]?.[i + 1]?.toString() || '0/0',
          applicationsReceived: json[8]?.[i + 1]?.toString() || '0/0',
          sendingSRA: json[9]?.[i + 1]?.toString() || '',
          sendingEndorsements: json[10]?.[i + 1]?.toString() || '',
          corrections: parseInt(json[11]?.[i + 1]) || 0,
        };
      });
      
      setWeeklyData(prev => ({
        ...prev,
        weekNumber: parseInt(weekNum) || getCurrentWeek(),
        days: newDays
      }));
    };
    reader.readAsArrayBuffer(file);
  };

  const calculateOutstandingEnd = (data) => {
    const today = new Date();
    const results = [];
    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      const monthName = monthStart.toLocaleString('en', { month: 'long' });
      let allCases = 0, canBeIssued = 0;
      data.forEach(row => {
        const sraExpiry = new Date(row['SRA Expiry date']);
        if (sraExpiry >= monthStart && sraExpiry <= monthEnd) {
          ['COC Number', 'GOC Number', 'COP - 1 Number', 'COP - 2 Number'].forEach(cert => {
            if (row[cert] && row[cert].trim()) {
              allCases++;
              if (row['Case paid to BMAR'] && row['Case paid to BMAR'].trim()) canBeIssued++;
            }
          });
        }
      });
      results.push({ month: monthName, allCases, canBeIssued });
    }
    setOutstandingEnd(results);
  };

  const findNextSRA = (data) => {
    const today = new Date();
    const upcoming = data.filter(row => new Date(row['SRA Expiry date']) >= today)
      .sort((a, b) => new Date(a['SRA Expiry date']) - new Date(b['SRA Expiry date']));
    if (upcoming.length > 0) {
      const next = upcoming[0];
      setNextSRA({ date: next['SRA Expiry date'], ship: next['Ship'], name: next['Name'], company: next['Invoice Address'] || '-' });
    }
  };

  const updateDayData = (day, field, value) => {
    setWeeklyData(prev => ({ ...prev, days: { ...prev.days, [day]: { ...prev.days[day], [field]: value } } }));
  };

  const addCorrectionNote = () => {
    if (!newCorrectionNote.trim()) return;
    setWeeklyData(prev => ({
      ...prev,
      correctionNotes: [
        ...prev.correctionNotes,
        { id: Date.now(), text: newCorrectionNote.trim(), completed: false }
      ]
    }));
    setNewCorrectionNote('');
  };

  const toggleCorrectionNote = (id) => {
    setWeeklyData(prev => ({
      ...prev,
      correctionNotes: prev.correctionNotes.map(note =>
        note.id === id ? { ...note, completed: !note.completed } : note
      )
    }));
  };

  const deleteCorrectionNote = (id) => {
    setWeeklyData(prev => ({
      ...prev,
      correctionNotes: prev.correctionNotes.filter(note => note.id !== id)
    }));
  };

  const downloadCrewboardExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['', 'Crewing Board', '', '', '', '', ''],
      ['', '', '', '', '', 'Week ', weeklyData.weekNumber],
      ['', '', '', '', '', '', ''],
      ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', ''],
      ['Endorsements to be issued', weeklyData.days.monday.endorsementsToBeIssued, weeklyData.days.tuesday.endorsementsToBeIssued, weeklyData.days.wednesday.endorsementsToBeIssued, weeklyData.days.thursday.endorsementsToBeIssued, weeklyData.days.friday.endorsementsToBeIssued, ''],
      ['Endorsements ready to be issued', weeklyData.days.monday.endorsementsReadyToBeIssued, weeklyData.days.tuesday.endorsementsReadyToBeIssued, weeklyData.days.wednesday.endorsementsReadyToBeIssued, weeklyData.days.thursday.endorsementsReadyToBeIssued, weeklyData.days.friday.endorsementsReadyToBeIssued, ''],
      ['Weeks ahead/     SRA Exp.', weeklyData.days.monday.weeksAheadSRAExp, weeklyData.days.tuesday.weeksAheadSRAExp, weeklyData.days.wednesday.weeksAheadSRAExp, weeklyData.days.thursday.weeksAheadSRAExp, weeklyData.days.friday.weeksAheadSRAExp, ''],
      ['Endorsements received', weeklyData.days.monday.endorsementsReceived, weeklyData.days.tuesday.endorsementsReceived, weeklyData.days.wednesday.endorsementsReceived, weeklyData.days.thursday.endorsementsReceived, weeklyData.days.friday.endorsementsReceived, ''],
      ['Applications / Cert per app', weeklyData.days.monday.applicationsReceived, weeklyData.days.tuesday.applicationsReceived, weeklyData.days.wednesday.applicationsReceived, weeklyData.days.thursday.applicationsReceived, weeklyData.days.friday.applicationsReceived, ''],
      ['Sending SRA', weeklyData.days.monday.sendingSRA, weeklyData.days.tuesday.sendingSRA, weeklyData.days.wednesday.sendingSRA, weeklyData.days.thursday.sendingSRA, weeklyData.days.friday.sendingSRA, ''],
      ['Sending Endorsements', weeklyData.days.monday.sendingEndorsements, weeklyData.days.tuesday.sendingEndorsements, weeklyData.days.wednesday.sendingEndorsements, weeklyData.days.thursday.sendingEndorsements, weeklyData.days.friday.sendingEndorsements, ''],
      ['Corrections', weeklyData.days.monday.corrections, weeklyData.days.tuesday.corrections, weeklyData.days.wednesday.corrections, weeklyData.days.thursday.corrections, weeklyData.days.friday.corrections, ''],
    ];
    
    // Add correction notes if any exist
    if (weeklyData.correctionNotes && weeklyData.correctionNotes.length > 0) {
      wsData.push(['', '', '', '', '', '', '']); // Empty row
      wsData.push(['Correction Notes', '', '', '', '', '', '']);
      weeklyData.correctionNotes.forEach((note, index) => {
        const status = note.completed ? '✓ DONE' : '○ PENDING';
        wsData.push([`${index + 1}. ${note.text}`, status, '', '', '', '', '']);
      });
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `Week_${weeklyData.weekNumber}.xlsx`);
  };

  const generatePDFReport = () => {
    const reportDate = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    
    const weeklyHistoryEntries = Object.entries(weeklyHistory).slice(-4);
    const weeklyTotal = weeklyHistoryEntries.reduce((sum, [_, val]) => sum + val, 0) + totals.perEndorsement;
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Seafarers Status ${reportDate}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #C00000; text-align: center; border-bottom: 2px solid #C00000; padding-bottom: 10px; }
    .section-title { background: #C00000; color: white; padding: 8px 15px; margin: 20px 0 10px 0; font-weight: bold; }
    table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: center; }
    th { background: #404040; color: white; }
    .total-row { background: #f2f2f2; font-weight: bold; }
    .notes { margin: 10px 0; padding-left: 20px; }
    .sra-alert { margin: 10px 0; }
    .sra-alert p { margin: 5px 0; }
    .sra-alert span { display: inline-block; width: 120px; font-weight: bold; color: #C00000; }
    .green-header th { background: #70AD47; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Seafarers Status ${reportDate}</h1>
  
  <div class="section-title">Week ${weeklyData.weekNumber} - Endorsements Received</div>
  <table>
    <tr><th>End Received</th><th>Per Seafarer</th><th>Per Endorsement Issued</th></tr>
    ${weeklyHistoryEntries.map(([week, val]) => `<tr><td>Week ${week}</td><td>-</td><td>${val}</td></tr>`).join('')}
    <tr><td>Week ${weeklyData.weekNumber}</td><td>${totals.perSeafarer}</td><td>${totals.perEndorsement}</td></tr>
    <tr class="total-row"><td>Total</td><td>-</td><td>${weeklyTotal}</td></tr>
  </table>
  
  <div class="section-title">Notes</div>
  <div class="notes">
    <p>• This week we received a total of ${totals.perEndorsement} endorsements.</p>
    <p>• This week we received ${totals.appSeafarer} applications - we have submitted ${totals.appCert} certificates.</p>
  </div>
  
  ${nextSRA ? `
  <div class="section-title">Next SRA Expiring</div>
  <div class="sra-alert">
    <p><span>Date:</span> ${nextSRA.date}</p>
    <p><span>Ship:</span> ${nextSRA.ship}</p>
    <p><span>Seafarer:</span> ${nextSRA.name}</p>
    <p><span>Company:</span> ${nextSRA.company}</p>
  </div>
  ` : ''}
  
  ${outstandingEnd ? `
  <div class="section-title">Outstanding End - Next 3 Months</div>
  <table>
    <tr><th>Outstanding End</th><th>All Cases</th><th>Can Be Issued</th></tr>
    ${outstandingEnd.map(item => `<tr><td>${item.month}</td><td>${item.allCases}</td><td>${item.canBeIssued}</td></tr>`).join('')}
    <tr class="total-row"><td>Total</td><td>${outstandingEnd.reduce((a,b) => a + b.allCases, 0)}</td><td>${outstandingEnd.reduce((a,b) => a + b.canBeIssued, 0)}</td></tr>
  </table>
  ` : ''}
  
  <div class="section-title">Monthly Overview - Endorsements Received</div>
  <table class="green-header">
    <tr><th>Month</th><th>Endorsements Received</th></tr>
    ${Object.entries(monthlyData).map(([month, val]) => {
      const date = new Date(month + '-01');
      return `<tr><td>${date.toLocaleString('en', { month: 'long', year: 'numeric' })}</td><td>${val}</td></tr>`;
    }).join('')}
  </table>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.onload = () => {
        setTimeout(() => newWindow.print(), 500);
      };
    }
  };

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-800 to-red-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🚢 Seafarers Status Dashboard</h1>
            <p className="text-red-200 text-sm">Portugal Flag - Endorsements 🇵🇹</p>
          </div>
          <div className="text-right">
            {lastSaved && (
              <p className="text-red-200 text-xs">
                💾 Guardado: {lastSaved.toLocaleTimeString('pt-PT')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto flex">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`px-6 py-4 font-medium transition-colors ${activeTab === 'dashboard' ? 'text-red-700 border-b-2 border-red-700 bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📊 Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('crewboard')} 
            className={`px-6 py-4 font-medium transition-colors ${activeTab === 'crewboard' ? 'text-red-700 border-b-2 border-red-700 bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📋 Crewboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="font-semibold mb-4 text-gray-700">📁 Upload Zoho CSV</h2>
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-all">
                  <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-gray-600">Click to upload CSV</p>
                  <p className="text-gray-400 text-sm mt-1">BMAREEndorsementsinprocess.csv</p>
                  {csvData && <p className="text-green-600 mt-3 font-medium">✅ {csvData.length} records loaded</p>}
                </label>
              </div>
              
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="font-semibold mb-4 text-gray-700">📊 Upload Weekly Excel</h2>
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all">
                  <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
                  <div className="text-4xl mb-2">📈</div>
                  <p className="text-gray-600">Click to upload Excel</p>
                  <p className="text-gray-400 text-sm mt-1">Week_XX.xlsx</p>
                </label>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                <p className="text-gray-500 text-sm">Week {weeklyData.weekNumber} Endorsements</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{totals.perEndorsement}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                <p className="text-gray-500 text-sm">Applications</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{totals.appSeafarer}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
                <p className="text-gray-500 text-sm">Certificates</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{totals.appCert}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-orange-500">
                <p className="text-gray-500 text-sm">Outstanding (3 months)</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{outstandingEnd ? outstandingEnd.reduce((a,b) => a + b.allCases, 0) : '-'}</p>
              </div>
            </div>

            {/* Next SRA Alert */}
            {nextSRA && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-600 rounded-xl shadow-md p-6">
                <h3 className="font-bold text-red-800 flex items-center gap-2 mb-4 text-lg">
                  ⚠️ Next SRA Expiring
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase">Date</p>
                    <p className="font-semibold text-red-700">{nextSRA.date}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase">Ship</p>
                    <p className="font-semibold">{nextSRA.ship}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase">Seafarer</p>
                    <p className="font-semibold">{nextSRA.name}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase">Company</p>
                    <p className="font-semibold">{nextSRA.company}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Outstanding End Table */}
            {outstandingEnd && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gray-800 text-white px-6 py-4">
                  <h3 className="font-semibold">Outstanding End - Next 3 Months</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-4 text-left">Month</th>
                      <th className="p-4 text-center">All Cases</th>
                      <th className="p-4 text-center">Can Be Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingEnd.map((item, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{item.month}</td>
                        <td className="p-4 text-center">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">{item.allCases}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">{item.canBeIssued}</span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td className="p-4">Total</td>
                      <td className="p-4 text-center text-blue-700">{outstandingEnd.reduce((a,b) => a + b.allCases, 0)}</td>
                      <td className="p-4 text-center text-green-700">{outstandingEnd.reduce((a,b) => a + b.canBeIssued, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Generate Report Button */}
            <button 
              onClick={generatePDFReport} 
              className="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 text-lg"
            >
              📄 Generate Weekly Report
            </button>
          </div>
        )}

        {activeTab === 'crewboard' && (
          <div className="space-y-6">
            {/* Week Number & Download */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <label className="font-semibold text-gray-700">Week Number:</label>
                  <input 
                    type="number" 
                    value={weeklyData.weekNumber} 
                    onChange={(e) => setWeeklyData(prev => ({ ...prev, weekNumber: parseInt(e.target.value) || 0 }))} 
                    className="border-2 border-gray-300 rounded-lg px-4 py-2 w-24 text-center text-xl font-bold focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={resetForNewWeek} 
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
                  >
                    🔄 Nova Semana
                  </button>
                  <button 
                    onClick={downloadCrewboardExcel} 
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
                  >
                    📥 Download Excel
                  </button>
                </div>
              </div>
            </div>

            {/* Crewboard Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gray-800 text-white px-6 py-4">
                <h2 className="text-xl font-bold">Crewing Board - Week {weeklyData.weekNumber}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-4 text-left font-semibold text-gray-700">Field</th>
                      {dayLabels.map(day => (
                        <th key={day} className="p-4 text-center font-semibold text-gray-700">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-blue-50">
                      <td className="p-4 font-medium">Endorsements to be issued</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].endorsementsToBeIssued} 
                            onChange={(e) => updateDayData(day, 'endorsementsToBeIssued', e.target.value)} 
                            placeholder="XX / YY"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-green-50">
                      <td className="p-4 font-medium">Endorsements ready to be issued</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].endorsementsReadyToBeIssued} 
                            onChange={(e) => updateDayData(day, 'endorsementsReadyToBeIssued', e.target.value)} 
                            placeholder="XX / YY"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-green-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-yellow-50">
                      <td className="p-4 font-medium">Weeks ahead / SRA Exp.</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].weeksAheadSRAExp} 
                            onChange={(e) => updateDayData(day, 'weeksAheadSRAExp', e.target.value)} 
                            placeholder="X / Y"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-yellow-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-50">Endorsements received</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].endorsementsReceived} 
                            onChange={(e) => updateDayData(day, 'endorsementsReceived', e.target.value)} 
                            placeholder="XX / YY"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-red-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-50">Applications / Cert</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].applicationsReceived} 
                            onChange={(e) => updateDayData(day, 'applicationsReceived', e.target.value)} 
                            placeholder="XX / YY"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-red-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-50">Sending SRA</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].sendingSRA} 
                            onChange={(e) => updateDayData(day, 'sendingSRA', e.target.value)}
                            placeholder="Name"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-red-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-50">Sending Endorsements</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="text" 
                            value={weeklyData.days[day].sendingEndorsements} 
                            onChange={(e) => updateDayData(day, 'sendingEndorsements', e.target.value)}
                            placeholder="Name"
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-red-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-50">Corrections</td>
                      {dayNames.map(day => (
                        <td key={day} className="p-2">
                          <input 
                            type="number" 
                            value={weeklyData.days[day].corrections} 
                            onChange={(e) => updateDayData(day, 'corrections', parseInt(e.target.value) || 0)}
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-center focus:border-red-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Totals */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-t">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 text-sm">Per Seafarer</p>
                    <p className="text-2xl font-bold text-green-700">{totals.perSeafarer}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 text-sm">Per Endorsement</p>
                    <p className="text-2xl font-bold text-green-700">{totals.perEndorsement}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 text-sm">Applications</p>
                    <p className="text-2xl font-bold text-blue-700">{totals.appSeafarer}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-gray-500 text-sm">Certificates</p>
                    <p className="text-2xl font-bold text-blue-700">{totals.appCert}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Correction Notes Section */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-orange-600 text-white px-6 py-4">
                <h2 className="text-xl font-bold">📝 Correction Notes</h2>
                <p className="text-orange-200 text-sm">Click on a note to mark as resolved (strikethrough)</p>
              </div>
              
              {/* Add new note */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCorrectionNote}
                    onChange={(e) => setNewCorrectionNote(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCorrectionNote()}
                    placeholder="Write a correction note..."
                    className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={addCorrectionNote}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
              
              {/* Notes list */}
              <div className="p-4">
                {weeklyData.correctionNotes.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No correction notes yet. Add one above.</p>
                ) : (
                  <ul className="space-y-2">
                    {weeklyData.correctionNotes.map((note) => (
                      <li 
                        key={note.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                          note.completed 
                            ? 'bg-gray-100 border-gray-300' 
                            : 'bg-orange-50 border-orange-200 hover:border-orange-400'
                        }`}
                      >
                        <button
                          onClick={() => toggleCorrectionNote(note.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            note.completed 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-400 hover:border-orange-500'
                          }`}
                        >
                          {note.completed && '✓'}
                        </button>
                        <span 
                          onClick={() => toggleCorrectionNote(note.id)}
                          className={`flex-1 ${note.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
                        >
                          {note.text}
                        </span>
                        <button
                          onClick={() => deleteCorrectionNote(note.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete note"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-gray-800 text-gray-400 text-center py-4 mt-8">
        <p className="text-sm">Seafarers Dashboard v1.0 • Portugal Flag - Endorsements 🇵🇹</p>
      </div>
    </div>
  );
}
