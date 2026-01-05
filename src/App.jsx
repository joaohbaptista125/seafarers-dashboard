import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

// Load saved data from localStorage (fallback while Supabase loads)
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
  const [weeklyHistory, setWeeklyHistory] = useState({});
  const [newCorrectionNote, setNewCorrectionNote] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [monthOverride, setMonthOverride] = useState(''); // Format: "2025-12" or empty for auto
  
  // Report editing states
  const [reportNotes, setReportNotes] = useState(() => 
    loadSavedData('seafarers_reportNotes', {
      note1: 'This week we received a total of {endorsements} endorsements.',
      note2: 'This week we received {applications} applications - we have submitted {certificates} certificates.',
      extraNotes: ''
    })
  );
  
  // Supabase sync states
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading', 'synced', 'error', 'saving'
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const saveTimeoutRef = useRef(null);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('dashboard_data')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) {
          // PGRST116 means no rows found - this is OK for first load
          if (error.code === 'PGRST116') {
            console.log('No data in Supabase yet, starting fresh');
            setSyncStatus('synced');
            setIsInitialLoad(false);
            return;
          }
          console.error('Supabase load error:', error);
          setSyncStatus('error');
          setIsInitialLoad(false);
          return;
        }

        if (data) {
          if (data.weekly_data) {
            setWeeklyData(data.weekly_data);
            localStorage.setItem('seafarers_weeklyData', JSON.stringify(data.weekly_data));
          }
          if (data.outstanding_end) {
            setOutstandingEnd(data.outstanding_end);
            localStorage.setItem('seafarers_outstandingEnd', JSON.stringify(data.outstanding_end));
          }
          if (data.next_sra) {
            setNextSRA(data.next_sra);
            localStorage.setItem('seafarers_nextSRA', JSON.stringify(data.next_sra));
          }
          if (data.weekly_history) {
            setWeeklyHistory(data.weekly_history);
            localStorage.setItem('seafarers_weeklyHistory', JSON.stringify(data.weekly_history));
          }
          setLastSaved(data.updated_at ? new Date(data.updated_at) : null);
        }
        
        setSyncStatus('synced');
        setIsInitialLoad(false);
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
        setSyncStatus('error');
        setIsInitialLoad(false);
      }
    };

    loadFromSupabase();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('dashboard_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'dashboard_data' },
        (payload) => {
          console.log('Realtime update received:', payload);
          const data = payload.new;
          if (data.weekly_data) setWeeklyData(data.weekly_data);
          if (data.outstanding_end) setOutstandingEnd(data.outstanding_end);
          if (data.next_sra) setNextSRA(data.next_sra);
          if (data.weekly_history) setWeeklyHistory(data.weekly_history);
          setLastSaved(data.updated_at ? new Date(data.updated_at) : null);
          setSyncStatus('synced');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save to Supabase with debounce
  const saveToSupabase = useCallback(async (weeklyDataVal, outstandingEndVal, nextSRAVal, weeklyHistoryVal) => {
    if (isInitialLoad) return;
    
    setSyncStatus('saving');
    
    try {
      const { error } = await supabase
        .from('dashboard_data')
        .upsert({
          id: 1,
          weekly_data: weeklyDataVal,
          outstanding_end: outstandingEndVal,
          next_sra: nextSRAVal,
          weekly_history: weeklyHistoryVal,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase save error:', error);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
      setSyncStatus('error');
    }
  }, [isInitialLoad]);

  // Debounced save effect
  useEffect(() => {
    if (isInitialLoad) return;
    
    // Also save to localStorage as backup
    localStorage.setItem('seafarers_weeklyData', JSON.stringify(weeklyData));
    if (outstandingEnd) localStorage.setItem('seafarers_outstandingEnd', JSON.stringify(outstandingEnd));
    if (nextSRA) localStorage.setItem('seafarers_nextSRA', JSON.stringify(nextSRA));
    if (weeklyHistory) localStorage.setItem('seafarers_weeklyHistory', JSON.stringify(weeklyHistory));
    
    // Debounce Supabase save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveToSupabase(weeklyData, outstandingEnd, nextSRA, weeklyHistory);
    }, 1000); // Wait 1 second before saving
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [weeklyData, outstandingEnd, nextSRA, weeklyHistory, isInitialLoad, saveToSupabase]);

  // Function to reset all data for new week
  const resetForNewWeek = async () => {
    if (window.confirm('⚠️ Are you sure you want to clear all data and start a new week?')) {
      const newData = { ...INITIAL_WEEKLY_DATA, weekNumber: getCurrentWeek() };
      setWeeklyData(newData);
      setOutstandingEnd(null);
      setNextSRA(null);
      setCsvData(null);
      localStorage.removeItem('seafarers_outstandingEnd');
      localStorage.removeItem('seafarers_nextSRA');
      
      // Also clear Supabase
      try {
        await supabase
          .from('dashboard_data')
          .upsert({
            id: 1,
            weekly_data: newData,
            outstanding_end: null,
            next_sra: null,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.error('Failed to reset Supabase:', err);
      }
    }
  };

  const calculateTotals = useCallback(() => {
    let perSeafarer = 0, perEndorsement = 0, appSeafarer = 0, appCert = 0;
    
    // Check if weeklyData and days exist
    if (!weeklyData || !weeklyData.days) {
      return { perSeafarer: 0, perEndorsement: 0, appSeafarer: 0, appCert: 0 };
    }
    
    Object.values(weeklyData.days).forEach(day => {
      if (day) {
        // Handle endorsementsReceived
        const endorsementsReceived = day.endorsementsReceived || '0/0';
        const endorsementsParts = String(endorsementsReceived).split('/');
        const es = parseInt(endorsementsParts[0]) || 0;
        const ee = parseInt(endorsementsParts[1]) || 0;
        
        // Handle applicationsReceived
        const applicationsReceived = day.applicationsReceived || '0/0';
        const applicationsParts = String(applicationsReceived).split('/');
        const as = parseInt(applicationsParts[0]) || 0;
        const ac = parseInt(applicationsParts[1]) || 0;
        
        perSeafarer += es; 
        perEndorsement += ee; 
        appSeafarer += as; 
        appCert += ac;
      }
    });
    
    return { perSeafarer, perEndorsement, appSeafarer, appCert };
  }, [weeklyData]);

  const totals = calculateTotals();

  // Helper function to get month from week number and year
  const getMonthFromWeek = (weekNum, year) => {
    // Calculate the date of the Monday of that week
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
    const firstMonday = new Date(year, 0, 1 + daysToMonday);
    const targetDate = new Date(firstMonday);
    targetDate.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    return targetDate.getMonth() + 1; // 1-12
  };

  // Calculate monthly data from weekly history
  const monthlyData = React.useMemo(() => {
    const result = {};
    
    Object.entries(weeklyHistory).forEach(([weekKey, data]) => {
      // Use monthYear if available (user-selected), otherwise use year from weekKey
      const [keyYear] = weekKey.split('-W');
      const year = data.monthYear || data.year || parseInt(keyYear) || 2025;
      const month = data.month || 12;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      
      if (!result[monthKey]) {
        result[monthKey] = { endorsements: 0, certificates: 0 };
      }
      result[monthKey].endorsements += data.endorsements || 0;
      result[monthKey].certificates += data.certificates || 0;
    });
    
    return result;
  }, [weeklyHistory]);

  // Save current week to history
  const saveWeekToHistory = () => {
    const weekNum = weeklyData.weekNumber;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Determine the correct year for this week
    let year;
    if (weekNum >= 49 && currentMonth <= 1) {
      year = currentYear - 1;
    } else if (weekNum <= 2 && currentMonth >= 10) {
      year = currentYear + 1;
    } else {
      year = currentYear;
    }
    
    // Use monthOverride if set, otherwise calculate from week
    let month, monthYear;
    if (monthOverride) {
      const [overrideYear, overrideMonth] = monthOverride.split('-').map(Number);
      monthYear = overrideYear;
      month = overrideMonth;
    } else {
      monthYear = year;
      month = getMonthFromWeek(weekNum, year);
    }
    
    // Ask for custom values if needed
    const useCustomValues = confirm(
      `Save Week ${weekNum} to ${month}/${monthYear}\n\n` +
      `Current values:\n` +
      `• Endorsements: ${totals.perEndorsement}\n` +
      `• Per Seafarer: ${totals.perSeafarer}\n` +
      `• Certificates: ${totals.appCert}\n\n` +
      `OK = Use current values\n` +
      `Cancel = Enter values manually`
    );
    
    let endorsements = totals.perEndorsement;
    let seafarers = totals.perSeafarer;
    let certificates = totals.appCert;
    
    if (!useCustomValues) {
      const customEnd = prompt(`Endorsements for ${month}/${monthYear}:`, totals.perEndorsement.toString());
      if (customEnd === null) return;
      endorsements = parseInt(customEnd) || 0;
      
      const customSea = prompt(`Per Seafarer for ${month}/${monthYear}:`, totals.perSeafarer.toString());
      if (customSea === null) return;
      seafarers = parseInt(customSea) || 0;
      
      const customCert = prompt(`Certificates for ${month}/${monthYear}:`, totals.appCert.toString());
      if (customCert === null) return;
      certificates = parseInt(customCert) || 0;
    }
    
    // Use month-specific key when using monthOverride (allows same week for different months)
    const weekKey = monthOverride 
      ? `${year}-W${String(weekNum).padStart(2, '0')}-${monthYear}-${String(month).padStart(2, '0')}`
      : `${year}-W${String(weekNum).padStart(2, '0')}`;
    
    // Check if already exists
    if (weeklyHistory[weekKey]) {
      if (!confirm(`This entry already exists. Do you want to replace it?`)) {
        return;
      }
    }
    
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const newHistory = {
      ...weeklyHistory,
      [weekKey]: {
        weekNumber: weekNum,
        year: year,
        month: month,
        monthYear: monthYear,
        endorsements: endorsements,
        seafarers: seafarers,
        certificates: certificates,
        savedAt: new Date().toISOString()
      }
    };
    
    setWeeklyHistory(newHistory);
    setMonthOverride('');
    alert(`✅ Week ${weekNum} saved!\n\nMonth: ${monthNames[month]} ${monthYear}\nEndorsements: ${endorsements}\nPer Seafarer: ${seafarers}\nCertificates: ${certificates}`);
  };

  // Delete week from history
  const deleteWeekFromHistory = (weekKey) => {
    if (!confirm(`Are you sure you want to delete ${weekKey}?`)) {
      return;
    }
    
    const newHistory = { ...weeklyHistory };
    delete newHistory[weekKey];
    setWeeklyHistory(newHistory);
  };

  // Helper function to convert Excel serial date to JS Date
  const excelDateToJS = (excelDate) => {
    if (typeof excelDate === 'number') {
      // Excel serial date (days since 1899-12-30, accounting for Excel's leap year bug)
      // Round to nearest day to handle times close to midnight
      const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899
      const days = Math.round(excelDate); // Round instead of floor to handle .999... cases
      const result = new Date(excelEpoch);
      result.setUTCDate(result.getUTCDate() + days);
      return result;
    } else if (typeof excelDate === 'string' && excelDate) {
      // Handle string dates
      const trimmed = excelDate.trim();
      // Try ISO format first (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const [year, month, day] = trimmed.split('T')[0].split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
      }
      // Try DD/MM/YYYY or DD-MM-YYYY
      const parts = trimmed.split(/[-/]/);
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (y > 1900) {
          return new Date(Date.UTC(y, m - 1, d));
        }
      }
      return new Date(excelDate);
    }
    return null;
  };

  // Format date for display (avoids timezone issues)
  const formatDate = (date) => {
    if (!date || isNaN(date.getTime())) return '-';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Process CSV file (used by both click and drag & drop)
  const processCSVFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      // Use XLSX to parse CSV properly (handles quoted fields with commas)
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // Use defval: '' to keep empty columns
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      
      console.log('CSV loaded:', jsonData.length, 'rows');
      console.log('Columns:', Object.keys(jsonData[0] || {}));
      console.log('First row:', jsonData[0]);
      
      setCsvData(jsonData);
      calculateOutstandingEnd(jsonData);
      findNextSRA(jsonData);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    processCSVFile(file);
  };

  // Drag & drop handlers
  const [isDraggingCSV, setIsDraggingCSV] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);

  const handleDragOver = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'csv') setIsDraggingCSV(true);
    else setIsDraggingExcel(true);
  };

  const handleDragLeave = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'csv') setIsDraggingCSV(false);
    else setIsDraggingExcel(false);
  };

  const handleDropCSV = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCSV(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processCSVFile(file);
    }
  };

  const handleDropExcel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExcel(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processExcelFile(file);
    }
  };

  // Process Excel file (used by both click and drag & drop)
  const processExcelFile = (file) => {
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

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    processExcelFile(file);
  };

  const calculateOutstandingEnd = (data) => {
    console.log('Calculating Outstanding End...');
    console.log('Sample row:', data[0]);
    
    // First, find all unique months in the CSV
    const monthsMap = new Map();
    
    data.forEach(row => {
      const sraExpiryRaw = row['SRA Expiry date'] || row['SRA Expiry Date'] || '';
      if (!sraExpiryRaw && sraExpiryRaw !== 0) return;
      
      const sraExpiry = excelDateToJS(sraExpiryRaw);
      if (!sraExpiry || isNaN(sraExpiry.getTime())) return;
      
      // Create a key for this month (YYYY-MM)
      const monthKey = `${sraExpiry.getFullYear()}-${String(sraExpiry.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, { allCases: 0, canBeIssued: 0 });
      }
      
      const monthData = monthsMap.get(monthKey);
      const hasPaid = row['Case paid to BMAR'] && String(row['Case paid to BMAR']).trim();
      
      const certs = ['COC Number', 'GOC Number', 'COP - 1 Number', 'COP - 2 Number'];
      certs.forEach(cert => {
        const certValue = row[cert];
        if (certValue && String(certValue).trim()) {
          monthData.allCases++;
          if (hasPaid) {
            monthData.canBeIssued++;
          }
        }
      });
    });
    
    // Convert to array and sort by date
    const results = Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = date.toLocaleString('en', { month: 'long', year: 'numeric' });
        return {
          month: monthName,
          allCases: data.allCases,
          canBeIssued: data.canBeIssued
        };
      });
    
    console.log('Outstanding End results:', results);
    setOutstandingEnd(results);
  };

  const findNextSRA = (data) => {
    // Use UTC for today to match SRA dates
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    console.log('Today UTC:', todayUTC.toISOString());
    
    const upcoming = data
      .filter(row => {
        const sraExpiryRaw = row['SRA Expiry date'] || row['SRA Expiry Date'] || '';
        if (!sraExpiryRaw && sraExpiryRaw !== 0) return false;
        const sraDate = excelDateToJS(sraExpiryRaw);
        const isUpcoming = sraDate && !isNaN(sraDate.getTime()) && sraDate > todayUTC;
        return isUpcoming;
      })
      .sort((a, b) => {
        const dateA = excelDateToJS(a['SRA Expiry date'] || a['SRA Expiry Date']);
        const dateB = excelDateToJS(b['SRA Expiry date'] || b['SRA Expiry Date']);
        return dateA - dateB;
      });
    
    console.log('Upcoming SRAs count:', upcoming.length);
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const sraDateRaw = next['SRA Expiry date'] || next['SRA Expiry Date'];
      const sraDate = excelDateToJS(sraDateRaw);
      const formattedDate = formatDate(sraDate);
      
      console.log('Next SRA raw value:', sraDateRaw);
      console.log('Next SRA parsed:', sraDate?.toISOString());
      console.log('Next SRA formatted:', formattedDate);
      
      setNextSRA({ 
        date: formattedDate, 
        ship: next['Ship'] || next['ship'] || '-', 
        name: next['Name'] || next['name'] || '-', 
        company: next['Invoice Address'] || next['Invoice address'] || '-' 
      });
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
    const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    
    // Group weekly history by week number (combine split weeks)
    const weeklyTotals = {};
    Object.entries(weeklyHistory).forEach(([weekKey, data]) => {
      // Extract year and week number from key (handles "2025-W53" and "2025-W53-2025-12")
      const match = weekKey.match(/^(\d{4})-W(\d+)/);
      if (match) {
        const [, year, weekNum] = match;
        const simpleKey = `${year}-W${weekNum}`;
        
        if (!weeklyTotals[simpleKey]) {
          weeklyTotals[simpleKey] = { endorsements: 0, seafarers: 0, certificates: 0, weekNumber: parseInt(weekNum) };
        }
        weeklyTotals[simpleKey].endorsements += data.endorsements || 0;
        weeklyTotals[simpleKey].seafarers += data.seafarers || 0;
        weeklyTotals[simpleKey].certificates += data.certificates || 0;
      }
    });
    
    // Sort and get last 5 weeks
    const sortedWeeks = Object.entries(weeklyTotals).sort(([a], [b]) => a.localeCompare(b));
    
    // Calculate the correct year for current week
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const weekNum = weeklyData?.weekNumber || 0;
    let weekYear;
    if (weekNum >= 49 && currentMonth <= 1) {
      weekYear = currentYear - 1;
    } else if (weekNum <= 2 && currentMonth >= 10) {
      weekYear = currentYear + 1;
    } else {
      weekYear = currentYear;
    }
    
    // Check if current week is already in history
    const currentWeekKey = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;
    const currentWeekInHistory = weeklyTotals[currentWeekKey];
    
    let weeklyHistoryEntries;
    let showCurrentWeek = false;
    
    if (currentWeekInHistory) {
      // Current week is saved - show last 5 from history only
      weeklyHistoryEntries = sortedWeeks.slice(-5);
    } else {
      // Current week not saved - show last 4 from history + current week
      weeklyHistoryEntries = sortedWeeks.slice(-4);
      showCurrentWeek = true;
    }
    
    // Calculate totals
    const historyEndorsements = weeklyHistoryEntries.reduce((sum, [_, val]) => sum + val.endorsements, 0);
    const historySeafarers = weeklyHistoryEntries.reduce((sum, [_, val]) => sum + val.seafarers, 0);
    
    const totalEndorsements = historyEndorsements + (showCurrentWeek ? totals.perEndorsement : 0);
    const totalSeafarers = historySeafarers + (showCurrentWeek ? totals.perSeafarer : 0);
    
    // Process notes with variable replacement
    const processedNote1 = reportNotes.note1
      .replace('{endorsements}', totals.perEndorsement)
      .replace('{applications}', totals.appSeafarer)
      .replace('{certificates}', totals.appCert);
    const processedNote2 = reportNotes.note2
      .replace('{endorsements}', totals.perEndorsement)
      .replace('{applications}', totals.appSeafarer)
      .replace('{certificates}', totals.appCert);
    const extraNotesHtml = reportNotes.extraNotes 
      ? reportNotes.extraNotes.split('\n').filter(line => line.trim()).map(line => `<p>• ${line}</p>`).join('')
      : '';
    
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
  
  <div class="section-title">Endorsements Received</div>
  <table>
    <tr><th>Week</th><th>Per Seafarer</th><th>Per Endorsement Issued</th></tr>
    ${weeklyHistoryEntries.map(([week, val]) => {
      const weekNum = week.match(/W(\d+)/)?.[1] || week;
      return `<tr><td>${weekNum}</td><td>${val.seafarers || '-'}</td><td>${val.endorsements}</td></tr>`;
    }).join('')}
    ${showCurrentWeek ? `<tr><td>${weeklyData?.weekNumber || '-'}</td><td>${totals.perSeafarer}</td><td>${totals.perEndorsement}</td></tr>` : ''}
    <tr class="total-row"><td>Total</td><td>${totalSeafarers}</td><td>${totalEndorsements}</td></tr>
  </table>
  
  <div class="section-title">Notes</div>
  <div class="notes">
    <p>• ${processedNote1}</p>
    <p>• ${processedNote2}</p>
    ${extraNotesHtml}
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
  <div class="section-title">Outstanding End</div>
  <table>
    <tr><th>Month</th><th>All Cases</th><th>Can Be Issued</th></tr>
    ${outstandingEnd.map(item => `<tr><td>${item.month}</td><td>${item.allCases}</td><td>${item.canBeIssued}</td></tr>`).join('')}
    <tr class="total-row"><td>Total</td><td>${outstandingEnd.reduce((a,b) => a + b.allCases, 0)}</td><td>${outstandingEnd.reduce((a,b) => a + b.canBeIssued, 0)}</td></tr>
  </table>
  ` : ''}
  
  ${Object.keys(monthlyData).length > 0 ? `
  <div class="section-title">Monthly Overview</div>
  <table class="green-header">
    <tr><th>Month</th><th>Endorsements</th><th>Certificates Submitted</th><th>Processing Rate</th><th>Net Flow</th></tr>
    ${Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => {
      const date = new Date(month + '-01');
      const endorsements = typeof data === 'object' ? data.endorsements : data;
      const certificates = typeof data === 'object' ? data.certificates : 0;
      const processingRate = endorsements > 0 ? Math.round((certificates / endorsements) * 100) : 0;
      const netFlow = endorsements - certificates;
      const netFlowClass = netFlow >= 0 ? 'color: green;' : 'color: red;';
      const netFlowSign = netFlow > 0 ? '+' : '';
      return `<tr><td>${date.toLocaleString('en', { month: 'long', year: 'numeric' })}</td><td>${endorsements}</td><td>${certificates}</td><td>${processingRate}%</td><td style="${netFlowClass}">${netFlowSign}${netFlow}</td></tr>`;
    }).join('')}
  </table>
  <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 12px;">
    <p style="margin: 3px 0;"><strong>📊 Legend:</strong></p>
    <p style="margin: 3px 0;">• <strong>Processing Rate</strong> = Certificates ÷ Endorsements × 100 (below 100% = reducing backlog)</p>
    <p style="margin: 3px 0;">• <strong>Net Flow</strong> = Endorsements − Certificates (<span style="color: green;">positive = good</span>, <span style="color: red;">negative = backlog increasing</span>)</p>
  </div>
  ` : ''}
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
            <p className="text-red-200 text-xs flex items-center gap-2 justify-end">
              {syncStatus === 'loading' && (
                <><span className="animate-pulse">⏳</span> A carregar...</>
              )}
              {syncStatus === 'saving' && (
                <><span className="animate-pulse">💾</span> A guardar...</>
              )}
              {syncStatus === 'synced' && (
                <><span className="text-green-300">☁️</span> Synced {lastSaved && `• ${lastSaved.toLocaleTimeString('en-GB')}`}</>
              )}
              {syncStatus === 'error' && (
                <><span className="text-yellow-300">⚠️</span> Offline (localStorage)</>
              )}
            </p>
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
          <button 
            onClick={() => setActiveTab('report')} 
            className={`px-6 py-4 font-medium transition-colors ${activeTab === 'report' ? 'text-red-700 border-b-2 border-red-700 bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📄 Report
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                <p className="text-gray-500 text-sm">Week {weeklyData?.weekNumber || '-'} Endorsements</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{isNaN(totals.perEndorsement) ? 0 : totals.perEndorsement}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                <p className="text-gray-500 text-sm">Applications Received</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{isNaN(totals.appSeafarer) ? 0 : totals.appSeafarer}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
                <p className="text-gray-500 text-sm">Certificates Submitted in BMAR</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{isNaN(totals.appCert) ? 0 : totals.appCert}</p>
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
                  <h3 className="font-semibold">Outstanding End</h3>
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

            {/* Weekly Endorsements Chart */}
            {Object.keys(weeklyHistory).length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-green-700 text-white px-6 py-4">
                  <h2 className="text-xl font-bold">📈 Weekly Endorsements Trend</h2>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={(() => {
                        // Group by week number
                        const grouped = {};
                        Object.entries(weeklyHistory).forEach(([weekKey, data]) => {
                          const weekNum = weekKey.match(/W(\d+)/)?.[1] || '0';
                          const simpleKey = weekKey.match(/^(\d{4}-W\d+)/)?.[1] || weekKey;
                          if (!grouped[simpleKey]) {
                            grouped[simpleKey] = { endorsements: 0, certificates: 0 };
                          }
                          grouped[simpleKey].endorsements += data.endorsements || 0;
                          grouped[simpleKey].certificates += data.certificates || 0;
                        });
                        return [
                          ...Object.entries(grouped)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([weekKey, data]) => ({
                              week: 'S' + (weekKey.match(/W(\d+)/)?.[1] || weekKey),
                              endorsements: data.endorsements,
                              certificates: data.certificates
                            })),
                          ...(totals.perEndorsement > 0 ? [{
                            week: `S${weeklyData?.weekNumber || '?'}*`,
                            endorsements: totals.perEndorsement,
                            certificates: totals.appCert
                          }] : [])
                        ];
                      })()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="week" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="endorsements" 
                        stroke="#16a34a" 
                        strokeWidth={3}
                        dot={{ fill: '#16a34a', strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 8 }}
                        name="Endorsements"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="certificates" 
                        stroke="#2563eb" 
                        strokeWidth={2}
                        dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                        name="Certificates"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-gray-400 text-xs text-center mt-2">* Current week (in progress)</p>
                </div>
              </div>
            )}

            {/* Monthly Overview */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-green-700 text-white px-6 py-4">
                <h2 className="text-xl font-bold">📊 Monthly Overview</h2>
                <p className="text-green-200 text-sm">Accumulated data from saved weeks</p>
              </div>
              <div className="p-4">
                {Object.keys(monthlyData).length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No monthly data yet. Save weeks to see the monthly summary.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-green-50">
                            <th className="p-3 text-left font-semibold text-gray-700">Month</th>
                            <th className="p-3 text-center font-semibold text-gray-700">Endorsements</th>
                            <th className="p-3 text-center font-semibold text-gray-700">Certificates Submitted</th>
                            <th className="p-3 text-center font-semibold text-gray-700">Processing Rate</th>
                            <th className="p-3 text-center font-semibold text-gray-700">Net Flow</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(monthlyData).sort(([a], [b]) => b.localeCompare(a)).map(([month, data]) => {
                            const date = new Date(month + '-01');
                            const processingRate = data.endorsements > 0 ? Math.round((data.certificates / data.endorsements) * 100) : 0;
                            const netFlow = data.endorsements - data.certificates;
                            return (
                              <tr key={month} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{date.toLocaleString('en', { month: 'long', year: 'numeric' })}</td>
                                <td className="p-3 text-center text-green-700 font-bold">{data.endorsements}</td>
                                <td className="p-3 text-center text-blue-700 font-bold">{data.certificates}</td>
                                <td className="p-3 text-center font-bold">
                                  <span className={processingRate <= 100 ? 'text-green-600' : 'text-orange-600'}>{processingRate}%</span>
                                </td>
                                <td className="p-3 text-center font-bold">
                                  <span className={netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {netFlow > 0 ? '+' : ''}{netFlow}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
                      <p className="font-semibold text-gray-700 mb-2">📊 Legend:</p>
                      <div className="grid md:grid-cols-2 gap-2 text-gray-600">
                        <p>• <strong>Processing Rate</strong> = Certificates ÷ Endorsements × 100</p>
                        <p className="text-green-600">↓ Below 100% = Reducing backlog</p>
                        <p>• <strong>Net Flow</strong> = Endorsements − Certificates</p>
                        <p><span className="text-green-600">Positive = Good</span> | <span className="text-red-600">Negative = Backlog ↑</span></p>
                      </div>
                    </div>

                    {/* Backlog Chart */}
                    <div className="mt-6">
                      <h3 className="font-semibold text-gray-700 mb-3">📈 Backlog Trend</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart
                          data={(() => {
                            let accumulated = 0;
                            return Object.entries(monthlyData)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([month, data]) => {
                                const netFlow = data.certificates - data.endorsements;
                                accumulated += netFlow;
                                const date = new Date(month + '-01');
                                return {
                                  month: date.toLocaleString('en', { month: 'short', year: '2-digit' }),
                                  endorsements: data.endorsements,
                                  certificates: data.certificates,
                                  backlog: accumulated
                                };
                              });
                          })()}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="month" stroke="#666" fontSize={12} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="certificates" 
                            stroke="#2563eb" 
                            strokeWidth={2}
                            dot={{ fill: '#2563eb', r: 4 }}
                            name="Certificates Submitted (in)"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="endorsements" 
                            stroke="#16a34a" 
                            strokeWidth={2}
                            dot={{ fill: '#16a34a', r: 4 }}
                            name="Endorsements (out)"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="backlog" 
                            stroke="#dc2626" 
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ fill: '#dc2626', r: 5 }}
                            name="Accumulated backlog"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-600 inline-block"></span> Certificates Submitted (in)</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-600 inline-block"></span> Endorsements (out)</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-red-600 inline-block border-dashed"></span> Accumulated backlog (dashed)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

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
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-gray-700">Month:</label>
                  <select
                    value={monthOverride}
                    onChange={(e) => setMonthOverride(e.target.value)}
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none"
                  >
                    <option value="">Auto</option>
                    <option value="2025-12">December 2025</option>
                    <option value="2026-01">January 2026</option>
                    <option value="2026-02">February 2026</option>
                    <option value="2026-03">March 2026</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={saveWeekToHistory} 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
                    title="Save this week's data to the monthly history"
                  >
                    💾 Save Week
                  </button>
                  <button 
                    onClick={resetForNewWeek} 
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
                  >
                    🔄 New Week
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

            {/* Weekly History Details */}
            {Object.keys(weeklyHistory).length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gray-100 px-6 py-3">
                  <h3 className="font-semibold text-gray-700">📅 Saved Weeks</h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {Object.entries(weeklyHistory).sort(([a], [b]) => b.localeCompare(a)).map(([weekKey, data]) => (
                    <div key={weekKey} className="bg-gray-50 rounded-lg p-3 text-center text-sm relative group">
                      <button
                        onClick={() => deleteWeekFromHistory(weekKey)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        ✕
                      </button>
                      <div className="font-bold text-gray-700 text-xs">{weekKey}</div>
                      <div className="text-green-600">{data.endorsements} end.</div>
                      <div className="text-blue-600">{data.certificates} cert.</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📄 Edit Weekly Report</h2>
              <p className="text-gray-600">Upload your data files and edit notes before generating the report.</p>
            </div>

            {/* Upload Section */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="font-semibold mb-4 text-gray-700">📁 Upload Zoho CSV</h2>
                <label 
                  className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    isDraggingCSV 
                      ? 'border-red-500 bg-red-100 scale-105' 
                      : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'csv')}
                  onDragLeave={(e) => handleDragLeave(e, 'csv')}
                  onDrop={handleDropCSV}
                >
                  <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                  <div className="text-4xl mb-2">{isDraggingCSV ? '📥' : '📄'}</div>
                  <p className="text-gray-600">{isDraggingCSV ? 'Drop here!' : 'Click or drag CSV'}</p>
                  <p className="text-gray-400 text-sm mt-1">BMAREEndorsementsinprocess.csv</p>
                  {csvData && <p className="text-green-600 mt-3 font-medium">✅ {csvData.length} records loaded</p>}
                </label>
              </div>
              
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="font-semibold mb-4 text-gray-700">📊 Upload Weekly Excel</h2>
                <label 
                  className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    isDraggingExcel 
                      ? 'border-green-500 bg-green-100 scale-105' 
                      : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'excel')}
                  onDragLeave={(e) => handleDragLeave(e, 'excel')}
                  onDrop={handleDropExcel}
                >
                  <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
                  <div className="text-4xl mb-2">{isDraggingExcel ? '📥' : '📈'}</div>
                  <p className="text-gray-600">{isDraggingExcel ? 'Drop here!' : 'Click or drag Excel'}</p>
                  <p className="text-gray-400 text-sm mt-1">Week_XX.xlsx</p>
                </label>
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-red-700 text-white px-6 py-4">
                <h3 className="font-bold">📝 Report Notes</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note 1 (Endorsements received)</label>
                  <input
                    type="text"
                    value={reportNotes.note1}
                    onChange={(e) => {
                      const newNotes = { ...reportNotes, note1: e.target.value };
                      setReportNotes(newNotes);
                      localStorage.setItem('seafarers_reportNotes', JSON.stringify(newNotes));
                    }}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
                    placeholder="This week we received a total of {endorsements} endorsements."
                  />
                  <p className="text-xs text-gray-400 mt-1">Use {'{endorsements}'} to insert the number automatically</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note 2 (Applications/Certificates)</label>
                  <input
                    type="text"
                    value={reportNotes.note2}
                    onChange={(e) => {
                      const newNotes = { ...reportNotes, note2: e.target.value };
                      setReportNotes(newNotes);
                      localStorage.setItem('seafarers_reportNotes', JSON.stringify(newNotes));
                    }}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
                    placeholder="This week we received {applications} applications..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Use {'{applications}'} and {'{certificates}'} to insert numbers automatically</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Extra Notes (optional)</label>
                  <textarea
                    value={reportNotes.extraNotes}
                    onChange={(e) => {
                      const newNotes = { ...reportNotes, extraNotes: e.target.value };
                      setReportNotes(newNotes);
                      localStorage.setItem('seafarers_reportNotes', JSON.stringify(newNotes));
                    }}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none h-24"
                    placeholder="Add extra notes here... (each line will be a bullet point)"
                  />
                </div>
              </div>
            </div>

            {/* Next SRA Edit */}
            {nextSRA && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-orange-600 text-white px-6 py-4">
                  <h3 className="font-bold">⚠️ Next SRA to Expire</h3>
                </div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                    <input
                      type="text"
                      value={nextSRA.date}
                      onChange={(e) => setNextSRA({ ...nextSRA, date: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ship</label>
                    <input
                      type="text"
                      value={nextSRA.ship}
                      onChange={(e) => setNextSRA({ ...nextSRA, ship: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seafarer</label>
                    <input
                      type="text"
                      value={nextSRA.name}
                      onChange={(e) => setNextSRA({ ...nextSRA, name: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <input
                      type="text"
                      value={nextSRA.company}
                      onChange={(e) => setNextSRA({ ...nextSRA, company: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Preview Section */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gray-700 text-white px-6 py-4">
                <h3 className="font-bold">👁️ Notes Preview</h3>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-gray-700">• {reportNotes.note1
                    .replace('{endorsements}', totals.perEndorsement)
                    .replace('{applications}', totals.appSeafarer)
                    .replace('{certificates}', totals.appCert)
                  }</p>
                  <p className="text-gray-700">• {reportNotes.note2
                    .replace('{endorsements}', totals.perEndorsement)
                    .replace('{applications}', totals.appSeafarer)
                    .replace('{certificates}', totals.appCert)
                  }</p>
                  {reportNotes.extraNotes && reportNotes.extraNotes.split('\n').filter(line => line.trim()).map((line, i) => (
                    <p key={i} className="text-gray-700">• {line}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button 
              onClick={generatePDFReport} 
              className="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 text-lg"
            >
              📄 Generate Weekly Report
            </button>
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
