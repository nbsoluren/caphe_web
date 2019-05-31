let data = {
    firebaseUser: null,
    user: null
};
let ui = null;

const firebaseConfig = {
    apiKey: "AIzaSyDAP5bsQk9IYpBbvUVQqvI7d4RqYh5Xdqs",
    authDomain: "baby-names-app-db-f5128.firebaseapp.com",
    databaseURL: "https://baby-names-app-db-f5128.firebaseio.com",
    projectId: "baby-names-app-db-f5128",
    storageBucket: "baby-names-app-db-f5128.appspot.com",
    messagingSenderId: "398460116167",
    appId: "1:398460116167:web:78c9c6c09226652e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let elements = {};

const species = {
    robusta: {days: [95,37,227,57]},
    arabica: {days: [77,21,178,88]},
    liberica: {days: [100,68,201,86]},
    excelsa: {days: [84,84,232,48]}
};
const stages = [
    {name: 'inflorescence', choices: [51, 53, 55, 57,59]},
    {name: 'flowering', choices: [61, 65, 69]},
    {name: 'berry development', choices: [71, 73, 75, 77,79]},
    {name: 'berry ripening', choices: [ 81, 85, 88]}
];
const chartDefaults = {
    type: 'doughnut',
    data: {
        datasets: [
            {
                data: [0,0,0,0],
                backgroundColor: [ '#4CAF50','#2196F3', '#FFEB3B', '#FF5722'],
                borderWidth: 0,
                labels: ['Inflorencence', 'Flowering', 'Berry Development', 'Berry Ripening']
            },
            {
                data: [0, 0],
                backgroundColor: ['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0)',],
                borderWidth: 0,
                labels: ['Current Stage', 'Remaining']
            }
        ],
    },
    options: {
        cutoutPercentage: 80,
        legend: {display: false, position: 'bottom'},
        responsive: true,
        maintainAspectRatio: false,
        rotation: 0.5 * Math.PI,
        tooltips: {
            callbacks: {
                label: (tooltipItem, data) => {
                    const dataset = data.datasets[tooltipItem.datasetIndex];
                    const index = tooltipItem.index;
                    const label = dataset.labels[index];
                    //const isProgress = ['progress', 'remaining'].includes(label.toLowerCase())
                    //return label + (isProgress ? (': ' + Math.round(dataset.data[index]) + '%') : ''); This was decided to be too tedious to do and probably erroneous. bale kasi % eh di dapat ganun... since even tougth may days from previous data, di naman necesarrily un din ung lalabas na days. 
                    return label;
                }
            }
        }
    }
}


async function onApplicationStart() {
    Promise.all([
        db.collection('model').doc('weatherData').get()
    ]).then(results => {
        data.weather = results[0].data();


        elements = {
            app: $('.app'),
            daysRemainingContainer: $('.days-remaining-container'),
            daysRemaining: $('.days-remaining'),
            errorContainer: $('.error-container'),
            logout: $('.logout'),
            login: $('.login'),
            records: $('#records'),
            timeline: $('.timeline'),
            username: $('.username'),
            choices: [$('.choice1'), $('.choice2'), $('.choice3'), $('.choice4'),$('.choice5')],
            addButton: $('.add-button'),
            recordName: $('#record-name'),
            recordNameWarning: $('.record-name-warning'),
            addModal: $('#add-record-modal'),
            deleteButton: $('.delete-button'),
            locationList: $('#location-list'),
            locationListWarning: $('.location-list-warning'),
            pie: $('.pie')
        };

        data.chart = new Chart(elements.pie[0].getContext('2d'), chartDefaults);

        elements.logout.off('click').on('click', () => {
            firebase.auth().signOut().then(() => {
                initializeAuthUI();
            })
        });

        elements.addButton.off('click').on('click', onAddButtonClicked);

        elements.records.off().change(() => {
            const selectedValue = parseInt($('#records option:selected').val());

            onRecordChanged(data.user.records[selectedValue]);
        });

        initializeAuthUI();
    })
}

function initializeAuthUI() {
    firebase.auth().onAuthStateChanged(onUserChanged);
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            if (!ui) {
                ui = new firebaseui.auth.AuthUI(firebase.auth());
            }
            ui.start('#login-container', {
                callbacks: {
                    signInSuccessWithAuthResult: () => false,
                },
                credentialHelper: firebaseui.auth.CredentialHelper.NONE,
                signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID]
            });
        })
}

function loadUser(user) {
    data.user = user;

    elements.login.addClass('hidden');
    elements.logout.removeClass('hidden');
    elements.app.removeClass('hidden');
    elements.username.text(user.name);

    elements.records.children('option:not(:first)').remove();

    let lastRecord;
    let lastElement;
    data.user.records.forEach((record, index) => {
        lastElement = elements.records.append(`<option value="${index}">${record.name} (${data.weather[record.location].name})</option>`);
        lastRecord = record;
    });

    if (lastRecord && lastElement) {
        elements.records.find(':last-child').attr('selected', 'selected');
        onRecordChanged(lastRecord);
    } else {
        onRecordChanged(null);
    }
}

async function onUserChanged(firebaseUser) {
    data.firebaseUser = firebaseUser;
    if (firebaseUser) {
        data.userSubscription = db.collection("users").doc(firebaseUser.uid)
            .onSnapshot(result => loadUser(result.data()));

        const result = await db.collection("users").doc(firebaseUser.uid).get();
        loadUser(result.data())

    } else {
        if (data.userSubscription) {
            data.userSubscription();
            data.userSubscription = null;
        }
        elements.login.removeClass('hidden');
        elements.logout.addClass('hidden');
        elements.app.addClass('hidden');
    }
}

function onRecordChanged(record) {
    if (!record) {
        elements.deleteButton.addClass('hidden');
        elements.errorContainer.removeClass('hidden');
        elements.timeline.addClass('hidden');
        elements.daysRemainingContainer.addClass('hidden');
        elements.errorContainer.text('No records found. Press the + button to add a record.');
        return;
    }

    elements.deleteButton.removeClass('hidden');
    elements.deleteButton.off().on('click', onDeleteButtonClicked);

    data.selectedRecord = record;
    const result = calculate(record);

    if (result.daysLeft < 0) {
        elements.daysRemainingContainer.addClass('hidden');
        elements.timeline.addClass('hidden');
        elements.errorContainer.removeClass('hidden');

        elements.errorContainer.text(result.daysLeft == -1 ? 'Not weather data for input date' : 'Not enough weather data to determine harvest date');
        return;
    }

    elements.errorContainer.addClass('hidden');
    elements.timeline.removeClass('hidden');
    elements.daysRemainingContainer.removeClass('hidden');

    elements.timeline.html('');
    for (let event of result.events) {
        const dateString = moment(event.date).format('MMM D YYYY');
        const className = event.stage.replace(/ /g, '-').toLowerCase();
        elements.timeline.append(`
                <li class="${className}">
                    <span class="stage">${event.stage}</span>
                    <span class="float-right">${dateString}</span>
                </li>
                `);
    }

    const dataset = species[record.species].days;
    data.chart.data.datasets[0].data = dataset;

    let index = 0;
    let stageBbchDone = 0;
    let stageBbchTotal = dataset.reduce((sum, value) => sum + value, 0);
    for (let stage of stages) {
        stageBbchDone += dataset[index++];
        console.log(stage.name, result.todayStage);
        if (stage.name == result.todayStage) {
            break;
        }
    }
    const stageBbchDonePercent = (stageBbchDone/stageBbchTotal) * 100
    data.chart.data.datasets[1].data = [stageBbchDonePercent, 100 - stageBbchDonePercent];
    data.chart.update();

    elements.daysRemaining.text(`${result.daysLeft}`);
}

function onAddButtonClicked() {
    for (let choice of elements.choices) {
        choice.off().on('click', (event) => incrementAddModalStage($(event.target).text()));
    }

    elements.locationList.html('');
    for (let index in data.weather) {
        elements.locationList.append(`<option value="${index}">${data.weather[index].name}</option>`)
    }

    elements.recordNameWarning.addClass('hidden');
    elements.locationListWarning.addClass('hidden');
    elements.recordName.removeClass('is-invalid')
    elements.recordName.val('');

    data.addModal = {
        stage: 0,
        rootBbch: -1,
        record: {}
    };
    incrementAddModalStage();


    elements.addModal.modal('show');
}

function onAddModalFinished(record) {
    record.location = elements.locationList.val();
    if (!record.location) {
        elements.locationListWarning.removeClass('hidden');
        return;
    }


    record.date = firebase.firestore.Timestamp.fromDate(new Date());

    db.collection('users')
        .doc(data.firebaseUser.uid)
        .update(
            {records: firebase.firestore.FieldValue.arrayUnion(record)}
        )
        .then(() => {
            elements.addModal.modal('hide');
        })
        .catch(error => {
            console.error(error);
            alert('Failed to add record.');
        });
}

function incrementAddModalStage(lastChoice) {
    let index;
    switch (data.addModal.stage) {
        case 0:
            index = 0;
            for (let speciesName in species) {
                elements.choices[index++]
                    .text(speciesName)
                    .css('background-image', `url(assets/species/${speciesName}.jpeg)`).removeClass('notOption');
            }
            elements.choices[4].addClass('notOption');
            data.addModal.stage = 1;
            break;
        case 1:
            data.addModal.record.species = lastChoice;

            index = 0;
            for (let stage of stages) {
                elements.choices[index++]
                    .text(stage.name)
                    .css('background-image', `url(assets/${lastChoice}/${stage.name.replace(/ /g, '')}.jpeg)`).removeClass('notOption');
            }
            elements.choices[4].addClass('notOption');
            data.addModal.stage = 2;
            break;
        case 2:
            const stageData = stages.find(stage => stage.name == lastChoice);
            for (let index of [0,1,2,3,4]) {
                elements.choices[index]
                    .text(`BBCH ${stageData.choices[index]}`)
                    .css('background-image', `url(assets/${data.addModal.record.species}/${lastChoice.replace(/ /g, '')}${index + 1}.jpeg)`).removeClass('notOption');
            }
            if(stageData.choices.length<4){
              elements.choices[3].addClass('notOption');
              elements.choices[4].addClass('notOption');
            }

            data.addModal.stage = 3;
            break;
        case 3:
            data.addModal.record.name = elements.recordName.val().trim();

            if (data.addModal.record.name == '') {
                elements.recordNameWarning.removeClass('hidden');
                elements.recordName.addClass('is-invalid')
                return;
            }

            data.addModal.record.bbch = parseInt(lastChoice.replace(/\D/g, ''));
            onAddModalFinished(data.addModal.record);

    }
}

function onDeleteButtonClicked() {
    if (confirm(`You are deleting the record ${data.selectedRecord.name} (${data.weather[data.selectedRecord.location].name})`)) {
        console.log('deleting', data.selectedRecord);
        db.collection('users')
            .doc(data.firebaseUser.uid)
            .update({records: firebase.firestore.FieldValue.arrayRemove(data.selectedRecord)})
            .then(() => console.log('Record deleted'))
            .catch(error => {
                console.error(error);
                alert('Failed to delete record.');
            });
    }
}
