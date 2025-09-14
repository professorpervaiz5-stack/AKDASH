import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, Clock, CheckCircle, AlertCircle, Calendar as CalendarIcon, BarChart3, Archive, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface WorkItem {
  date: string;
  employeeName: string;
  work: string;
  status: 'pending' | 'working' | 'finished';
  timestamp: number;
}

type ViewMode = 'live' | 'monthly' | 'pending';

const Dashboard = () => {
  const [data, setData] = useState<WorkItem[]>([]);
  const [allData, setAllData] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  // Clear old data and load fresh data from localStorage
  useEffect(() => {
    // Clear old stored data to start fresh
    localStorage.removeItem('sial-dashboard-data');
    setAllData([]);
  }, []);

  // Save data to localStorage whenever allData changes
  useEffect(() => {
    if (allData.length > 0) {
      localStorage.setItem('sial-dashboard-data', JSON.stringify(allData));
    }
  }, [allData]);

  const fetchData = async () => {
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/1Xz7VJdOsAM1RflWBET1q08GU0RMImx6HO2hsBFzExx4/export?format=csv');
      const csvText = await response.text();
      
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const parsedData: WorkItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length >= 4 && values[1] && values[2]) {
            const workItem: WorkItem = {
              date: values[0] || new Date().toLocaleDateString(),
              employeeName: values[1] || '',
              work: values[2] || '',
              status: (values[3]?.toLowerCase() as 'pending' | 'working' | 'finished') || 'pending',
              timestamp: Date.now()
            };
            parsedData.push(workItem);
          }
        }
      }
      
      setData(parsedData);
      
      // Merge new data with existing stored data, avoiding duplicates
      setAllData(prevAllData => {
        const newItems = parsedData.filter(newItem => 
          !prevAllData.some(existingItem => 
            existingItem.employeeName === newItem.employeeName && 
            existingItem.work === newItem.work &&
            existingItem.date === newItem.date
          )
        );
        return [...prevAllData, ...newItems];
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusVariant = (status: string): 'pending' | 'working' | 'finished' | 'secondary' => {
    switch (status.toLowerCase()) {
      case 'finished': return 'finished';
      case 'working': return 'working';
      case 'pending': return 'pending';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'finished': return <CheckCircle className="w-4 h-4" />;
      case 'working': return <Clock className="w-4 h-4" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Get today's date in MM-DD-YY format
  const getTodayString = () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = String(today.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  // Get latest date with data
  const getLatestDate = () => {
    if (data.length === 0) return null;
    const dates = data.map(item => item.date).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return dates[0];
  };

  // Convert date string to Date object for calendar
  const parseDate = (dateStr: string) => {
    try {
      // Parse MM-DD-YY format
      const [month, day, year] = dateStr.split('-');
      return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch {
      return new Date();
    }
  };

  // Convert Date object to MM-DD-YY format
  const formatDateToString = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  // Get unique dates for the selected month
  const getAvailableDates = () => {
    const monthData = allData.filter(item => {
      const itemDate = new Date(item.date);
      const itemMonth = itemDate.toISOString().slice(0, 7);
      return itemMonth === selectedMonth;
    });
    
    const dates = Array.from(new Set(monthData.map(item => item.date)))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return dates;
  };

  // Get data based on view mode
  const getDisplayData = () => {
    switch (viewMode) {
      case 'live':
        // Show only today's work (all statuses: pending, working, finished)
        const today = getTodayString();
        return data.filter(item => item.date === today);
      case 'monthly':
        let monthData = allData.filter(item => {
          const itemDate = parseDate(item.date);
          const itemMonth = itemDate.toISOString().slice(0, 7);
          return itemMonth === selectedMonth;
        });
        
        // Filter by calendar selected date if available
        if (calendarDate) {
          const selectedDateStr = formatDateToString(calendarDate);
          monthData = monthData.filter(item => item.date === selectedDateStr);
        }
        
        return monthData;
      case 'pending':
        // Show all pending tasks from all dates
        return allData.filter(item => item.status.toLowerCase() === 'pending').slice(0, 50);
      default:
        return data;
    }
  };

  const displayData = getDisplayData();
  const latestDate = getLatestDate();
  const todayDate = getTodayString();
  
  const stats = {
    total: displayData.length,
    pending: displayData.filter(item => item.status === 'pending').length,
    working: displayData.filter(item => item.status === 'working').length,
    finished: displayData.filter(item => item.status === 'finished').length,
  };

  const abdullahWork = displayData.filter(item => item.employeeName.toLowerCase().includes('abdullah'));
  const ayeshaWork = displayData.filter(item => item.employeeName.toLowerCase().includes('ayesha'));

  // Get completed work separately for each employee
  const abdullahCompleted = allData.filter(item => 
    item.employeeName.toLowerCase().includes('abdullah') && item.status === 'finished'
  );
  const ayeshaCompleted = allData.filter(item => 
    item.employeeName.toLowerCase().includes('ayesha') && item.status === 'finished'
  );

  if (loading && viewMode === 'live') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
        <div className="rounded-full h-12 w-12 border-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 border-2 border-border rounded-lg">
      {/* Header */}
      <header className="bg-card border-2 border-border shadow-2xl rounded-lg mb-6">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">SIAL Connection</h1>
              <p className="text-muted-foreground">
                Team Dashboard - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
                {viewMode === 'live' && (
                  <span className="ml-2 text-primary">({todayDate})</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Live Data
              </div>
            </div>
          </div>
          
          {/* View Mode Controls */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              variant={viewMode === 'live' ? 'default' : 'secondary'}
              onClick={() => {
                setViewMode('live');
                setCalendarDate(undefined);
              }}
              className=""
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Live View
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'secondary'}
              onClick={() => {
                setViewMode('monthly');
                setCalendarDate(new Date());
              }}
              className=""
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Monthly View
            </Button>
            <Button
              variant={viewMode === 'pending' ? 'default' : 'secondary'}
              onClick={() => {
                setViewMode('pending');
                setCalendarDate(undefined);
              }}
              className=""
            >
              <Clock className="w-4 h-4 mr-2" />
              Pending Tasks
            </Button>
            
            {viewMode === 'monthly' && (
              <>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCalendarDate(new Date(e.target.value + '-01'));
                  }}
                  className="px-3 py-2 bg-card border border-border rounded-md text-foreground"
                />
                <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-60 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {calendarDate ? format(calendarDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={calendarDate}
                      onSelect={(date) => {
                        setCalendarDate(date);
                        setShowCalendar(false);
                        if (date) {
                          const selectedMonthFromDate = date.toISOString().slice(0, 7);
                          setSelectedMonth(selectedMonthFromDate);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 border-2 border-border rounded-lg bg-card/30">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 p-4 border-2 border-border rounded-lg bg-card/20">
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Total Tasks</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-pending" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pending">{stats.pending}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-working" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-working">{stats.working}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-finished" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-finished">{stats.finished}</div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 p-4 border-2 border-border rounded-lg bg-card/20">
          {/* Abdullah's Work */}
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground font-bold border-2 border-border">
                  A
                </div>
                <span className="text-primary">ABDULLAH</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Total Completed: <span className="text-finished font-semibold">{abdullahCompleted.length}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-96 w-full rounded-md border-2 border-border pr-4">
              {abdullahWork.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No tasks for this view</p>
              ) : (
                abdullahWork.slice(-10).reverse().map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg border-2 border-border/50 mb-2">
                    <div className="mt-1 text-primary">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-2 text-foreground">{item.work}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(item.status)} className="">
                          Work Status: {item.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Ayesha's Work */}
          <Card className="bg-gradient-to-br from-card to-card/50 border-2 border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center text-primary-foreground font-bold border-2 border-border">
                  A
                </div>
                <span className="text-primary">AYESHA</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Total Completed: <span className="text-finished font-semibold">{ayeshaCompleted.length}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-96 w-full rounded-md border-2 border-border pr-4">
              {ayeshaWork.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No tasks for this view</p>
              ) : (
                ayeshaWork.slice(-10).reverse().map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg border-2 border-border/50 mb-2">
                    <div className="mt-1 text-primary">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-2 text-foreground">{item.work}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(item.status)} className="">
                          Work Status: {item.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="text-primary">
              {viewMode === 'pending' ? 'All Pending Tasks' : 
               viewMode === 'live' ? `Today's Activity (${todayDate})` :
               calendarDate ? `Activity for ${format(calendarDate, "PPP")}` : 'Monthly Activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded-md border-0 pr-4">
              <div className="space-y-4">
              {displayData.slice(-15).reverse().map((item, index) => (
                <div key={index} className="flex items-center gap-4 py-3 border-b border-border/30 last:border-b-0">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.employeeName}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.work}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(item.status)} className="">
                      Work Status: {item.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{item.date}</span>
                  </div>
                </div>
              ))}
                {displayData.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No data available for this view</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;