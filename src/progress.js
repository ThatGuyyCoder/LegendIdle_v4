function defaultProgress() {
  return {
    skills: {
      Võitlus: 1,
      Kogumine: 1,
      Meisterlikkus: 1,
      Maagia: 1,
    },
    gold: 0,
    lastTraining: null,
  };
}

function cloneProgress(progress) {
  return JSON.parse(JSON.stringify(progress || defaultProgress()));
}

module.exports = {
  defaultProgress,
  cloneProgress,
};
