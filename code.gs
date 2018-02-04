// myFunction is the entry point to this program (and you can't rename this function!?)
function myFunction() {
  // track when this script was executed
  logTriggerStart()

  var companyName = "<Your G Suite Company Name>"

  // change to `true` for the first run to create a new tracking spreadsheet
  // otherwise leave this conditional check set to `false`
  if (false) { createSpreadsheet(companyName); return }

  // set your personal google account id (i.e. your personal google account email)
  var personalGoogleAccountID = "<your.name>@gmail.com"

  // acquire a reference to your personal google account calendar
  var personalCalendar = CalendarApp.getCalendarById(personalGoogleAccountID);

  // acquire a reference to your default calendar (which will be relative to the account this script executes under)
  // note: this script should be executed within your g suite account for this lookup to work as expected
  var gSuiteCalendar = CalendarApp.getDefaultCalendar();

  // we'll be looking at syncing events for today
  var today = new Date()

  // Uncomment following line if you want to test this script for a day in the future
  // today.setDate(today.getDate() + 1)

  var gSuiteEvents = gSuiteCalendar.getEventsForDay(today)
  var trackGSuiteEvents = {}

  gSuiteEvents.forEach(function(event){
    // logEvents(event)
    trackGSuiteEvents[event.getId()] = event
  })

  // id of spreadsheet (needed to track calendar events)
  var sheetID = "<your_spreadsheet_id>"
  var sheet = SpreadsheetApp.openById(sheetID)

  // acquire data from spreadsheet
  var range = sheet.getDataRange()
  var rows = range.getValues()

  // only bother to execute the following code if our spreadsheet has some tracked events
  if (rows.length > 1) {
    checkForEventUpdates(rows, trackGSuiteEvents, personalCalendar, personalGoogleAccountID, sheet, companyName)

    // don't proceed further
    return
  }

  // no tracked events were found in our spreadsheet, so let's start tracking them...
  generateEvents(trackGSuiteEvents, personalCalendar, personalGoogleAccountID, sheet, companyName)
}

function logTriggerStart() {
  var d = new Date()
  var hour = d.getHours().toString()
  var minute = d.getMinutes().toString()

  Logger.log("Event has been triggered: %s:%s", hour, minute)
}

function logEvents(e) {
  Logger.log(e)
  Logger.log("\nID: %s\nTitle: %s\nStart: %s\n End: %s", e.getId(), e.getTitle(), e.getStartTime(), e.getEndTime())
}

function createSpreadsheet(companyName) {
  var sheet = SpreadsheetApp.create(companyName + " Sync")
      sheet.appendRow(["gsuite_event_id", "personal_event_id", "event_title", "event_start"]);
  Logger.log(sheet.getId())
}

function checkForEventUpdates(rows, trackGSuiteEvents, personalCalendar, personalGoogleAccountID, sheet, companyName) {
  // track rows that should be deleted
  oldEvents = []

  // loop over the events we have for today
  for (current_event_id in trackGSuiteEvents) {
    var event_found = false

    // go over our spreadsheet data (row by row) and search for existing gsuite ids
    rows.forEach(function(row, index){
      // skip the first row (which is just our column headers)
      if (index > 0) {
        // check for old events and mark them for deletion (otherwise our spreadsheet loop would get longer over time)
        markOldEvents(row, oldEvents, sheet, index)

        // assign descriptive names to our spreadsheet data
        var spreadsheet_gsuite_event_id = row[0]
        var spreadsheet_personal_event_id = row[1]
        var spreadsheet_gsuite_event_title = row[2]
        var spreadsheet_gsuite_event_start = row[3]

        // is the event we're looking at already tracked?
        if (spreadsheet_gsuite_event_id == current_event_id) {
          event_found = true
          var gsuite_event = trackGSuiteEvents[spreadsheet_gsuite_event_id]
          var date1 = (new Date(gsuite_event.getStartTime())).getTime()
          var date2 = (new Date(spreadsheet_gsuite_event_start)).getTime()

          var event_title = gsuite_event.getTitle()
          var event_start = new Date(gsuite_event.getStartTime())
          var event_end = new Date(gsuite_event.getEndTime())

          var title_changed = event_title != spreadsheet_gsuite_event_title
          var date_changed = date1 != date2

          var personalCalendarEvent = personalCalendar.getEventById(spreadsheet_personal_event_id)
          var subject = "Event from your " + companyName + " account has been updated"

          if (title_changed && date_changed) {
            updateTitle(personalCalendarEvent, index, sheet, event_title)
            updateDate(personalCalendarEvent, index, sheet, event_start, event_end)

            var body = "Both the title and the start/end times were updated to:\n\n" + event_title + "\n\n" + event_start + "\n-\n" + event_end
            GmailApp.sendEmail(personalGoogleAccountID, subject, body);
          }
          else if (title_changed) {
            updateTitle(personalCalendarEvent, index, sheet, event_title)

            var body = "Title was updated to:\n" + event_title
            GmailApp.sendEmail(personalGoogleAccountID, subject, body);
          }
          else if (date_changed) {
            updateDate(personalCalendarEvent, index, sheet, event_start, event_end)

            var body = "Start/End time was updated to:\n\n" + event_start + "\n-\n" + event_end
            GmailApp.sendEmail(personalGoogleAccountID, subject, body);
          }
        }
      }
    })

    // if we didn't find the current event, then create it
    if (!event_found) {
      filtered_event_object = {}
      filtered_event_object[current_event_id] = trackGSuiteEvents[current_event_id]
      generateEvents(filtered_event_object, personalCalendar, personalGoogleAccountID, sheet)
    }
  }

  if (oldEvents.length > 0) {
    oldEvents.forEach(function(rowNumber){
      sheet.deleteRow(rowNumber)
    })
  }
}

function markOldEvents(row, oldEvents, sheet, index) {
  var today = new Date()

  // Uncomment following line if you want to test this script for a day in the future
  // today.setDate(today.getDate() + 1)

  var storedDay = new Date(row[3])

  // if the current event doesn't match today's date, then mark it for deletion
  if (storedDay.getDate() != today.getDate()) {
    // to avoid marking the same row number multiple times we first check for it
    if (oldEvents.indexOf(index+1) == -1) {
      oldEvents.push(index+1)
    }
  }
}

function updateTitle(personalCalendar, index, sheet, event_title) {
  var rangeForCurrentEventTitle = sheet.getRange("C" + (index+1));
  sheet.setActiveRange(rangeForCurrentEventTitle)
  rangeForCurrentEventTitle.setValue(event_title)
  personalCalendar.setTitle(event_title)
}

function updateDate(personalCalendar, index, sheet, event_start, event_end) {
  var rangeForCurrentEventDate = sheet.getRange("D" + (index+1));
  sheet.setActiveRange(rangeForCurrentEventDate)
  rangeForCurrentEventDate.setValue(event_start)
  personalCalendar.setTime(event_start, event_end)
}

function generateEvents(untrackedEvents, personalCalendar, personalGoogleAccountID, sheet, companyName) {
  // take incoming event object and generate a copy of the events within our personal google calendar
  for (var eventID in untrackedEvents) {
    var event = untrackedEvents[eventID]
    var startTime = new Date(event.getStartTime())
    var endTime = new Date(event.getEndTime())
    var eventTitle = event.getTitle()
    var eventDescription = event.getDescription()
    var newPersonalEvent = personalCalendar.createEvent(eventTitle, startTime, endTime, {description: eventDescription});

    // track this new event in our spreadsheet so we can check in future for any changes made to it
    sheet.appendRow([event.getId(), newPersonalEvent.getId(), eventTitle, startTime]);

    var body = "Title: " + eventTitle + "\n\nDescription:\n" + eventDescription

    // send an email to let your personal google account know about the new event added
    var subject = "Event from your " + companyName + " account has been synced"
    GmailApp.sendEmail(personalGoogleAccountID, subject, body);
  }
}
