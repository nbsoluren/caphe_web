function calculate(record) {
    const inputDateString = moment(data['date']).format('YYYY-MM-DD');
    const todayString = moment().format('YYYY-MM-DD');
    const weather = data.weather[record.location];
    const speciesData = weather['berries'][record.species.toLowerCase()];
    const targetBbch = speciesData[record.bbch.toString()];
    const stageValues = [speciesData["51"], speciesData["61"], speciesData["71"], speciesData["81"]];
    const result = {events: []};

    result.sum = 0;
    result.locationName = weather.name || record.location;
    let lastEvent = null;
    for (let current of weather.temperatures) {
        const currentDate = current['date'].toDate();
        const currentDateString = moment(currentDate).format('YYYY-MM-DD');

        if (currentDateString == inputDateString) {
            result.firstDayFound = currentDate;
        }

        if (result.firstDayFound) {
            const gdd = (current['minTemp'] + current['maxTemp']) / 2.0 - 10.0;
            result.sum += gdd;

            const remainingBbch = targetBbch - result.sum;
            const event = (remainingBbch <= stageValues[3])
                ? 'berry ripening'
                : (remainingBbch <= stageValues[2])
                    ? 'berry development'
                    : (remainingBbch <= stageValues[1])
                        ? 'flowering'
                        : 'inflorescence';

            if (currentDateString == todayString) {
               result.todayStage = event;
            }

            if (lastEvent != event) {
                result.events.push({date: currentDate, stage: lastEvent ? event : 'record added'});
                lastEvent = event;
            }

            if (result.sum > targetBbch) {
                result.events.push({date: currentDate, stage: 'Predicted Harvest Date'});
                result.harvestDate = currentDate;
                break;
            }
        }
    }

    if (!result.firstDayFound) {
        result.daysLeft = -1;
        return result;
    }

    if (!result.harvestDate) {
        result.daysLeft = -2;
        return result;
    }

    result.daysLeft = moment(result.harvestDate).startOf('day').diff(moment().startOf('day'), 'day');

    return result;
}
